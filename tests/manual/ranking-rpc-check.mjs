#!/usr/bin/env node
/**
 * `public.replace_ranking_snapshot()` 검증 (마이그레이션 20260908002000).
 *
 * 확인하는 것
 *   1) anon(세션 없음)      → 42501 (EXECUTE 권한 자체가 없다)
 *   2) 로그인했지만 일반 사용자 → 42501 (함수 첫 줄의 is_admin() 검사)
 *   3) 관리자 + 깨진 입력    → 22023 이고 **한 행도 남지 않는다**(원자성)
 *   4) 관리자 + 정상 입력    → 새 snapshot_at 하나로 전 행이 묶인다
 *   5) 6번 올리면 최근 5개 스냅샷만 남는다(보관 정책)
 *
 * 실행:  node tests/manual/ranking-rpc-check.mjs
 *
 * 안전장치
 *   * 검증은 `rank_type = 'job'` 으로만 한다. 사용자 화면(lib/data/rankings.ts)은
 *     `total` 스냅샷만 읽으므로 이 스크립트가 노출 데이터를 건드리지 않는다.
 *     그래도 시작 전에 해당 타입이 비어 있는지 확인하고, 아니면 중단한다.
 *   * 관리자 세션은 임시 계정을 만들어 얻고, 끝나면 계정과 검증 행을 모두 지운다.
 *     (관리자 비밀번호를 알 필요가 없어야 이 스크립트를 아무나 돌릴 수 있다.)
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
  if (match !== null && process.env[match[1]] === undefined) {
    process.env[match[1]] = match[2]
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

const PROBE_TYPE = 'job'
const service = createClient(URL, SERVICE, { auth: { persistSession: false } })

const results = []

function check(name, passed, detail) {
  results.push({ name, passed, detail })
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : ` — ${detail}`}`)
}

function rows(count, offset = 0) {
  return Array.from({ length: count }, (_, index) => ({
    rank: index + 1,
    character_name: `probe${offset}-${index + 1}`,
    level: 200 + index,
    job: '히어로',
    job_group: 'hero',
    guild: index % 2 === 0 ? '검증길드' : null,
    exp: '1.0B',
  }))
}

async function countProbeRows() {
  const { count } = await service
    .from('rankings')
    .select('*', { count: 'exact', head: true })
    .eq('rank_type', PROBE_TYPE)

  return count ?? 0
}

async function snapshots() {
  const { data } = await service
    .from('rankings')
    .select('snapshot_at')
    .eq('rank_type', PROBE_TYPE)

  return [...new Set((data ?? []).map((row) => row.snapshot_at))]
}

/* ---------------------------------------------------------------- 0. 전제 */
const initialRows = await countProbeRows()

if (initialRows !== 0) {
  console.error(
    `중단: rank_type='${PROBE_TYPE}' 에 이미 ${initialRows}행이 있다. 실제 데이터를 지울 수 있어 실행하지 않는다.`,
  )
  process.exit(1)
}

/* ------------------------------------------------------------- 1. anon */
{
  const anon = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error } = await anon.rpc('replace_ranking_snapshot', {
    p_rank_type: PROBE_TYPE,
    p_rows: rows(3),
  })

  check('anon 호출은 42501', error?.code === '42501', error?.code ?? '에러 없음(!)')
}

/* --------------------------------------------- 2. 임시 계정 생성 → 일반 사용자 */
const email = `rpc-probe-${randomUUID()}@example.com`
const password = randomUUID()

const { data: created, error: createError } = await service.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
})

if (createError !== null) {
  console.error('임시 계정 생성 실패:', createError.message)
  process.exit(1)
}

const userId = created.user.id
const session = createClient(URL, ANON, { auth: { persistSession: false } })
const { error: signInError } = await session.auth.signInWithPassword({ email, password })

if (signInError !== null) {
  console.error('임시 계정 로그인 실패:', signInError.message)
  await service.auth.admin.deleteUser(userId)
  process.exit(1)
}

{
  const { error } = await session.rpc('replace_ranking_snapshot', {
    p_rank_type: PROBE_TYPE,
    p_rows: rows(3),
  })

  check('일반 사용자 호출은 42501', error?.code === '42501', error?.code ?? '에러 없음(!)')
}

/* ------------------------------------------------------------ 3. 관리자 승격 */
await service.from('profiles').update({ role: 'admin' }).eq('id', userId)

/* --------------------------------------------------- 4. 깨진 입력 → 원자성 */
{
  const broken = rows(3).map((row) => (row.rank === 2 ? { ...row, rank: 9 } : row))
  const { error } = await session.rpc('replace_ranking_snapshot', {
    p_rank_type: PROBE_TYPE,
    p_rows: broken,
  })

  check('순위가 끊기면 22023', error?.code === '22023', error?.message ?? '에러 없음(!)')
  check('실패한 호출은 한 행도 남기지 않는다', (await countProbeRows()) === 0)
}

{
  const missing = [{ rank: 1, character_name: '  ', job: '히어로', job_group: 'hero' }]
  const { error } = await session.rpc('replace_ranking_snapshot', {
    p_rank_type: PROBE_TYPE,
    p_rows: missing,
  })

  check('필수 칸이 비면 22023', error?.code === '22023', error?.message ?? '에러 없음(!)')
}

/* ------------------------------------------------------ 5. 정상 적재 + 보관 */
{
  const { data, error } = await session.rpc('replace_ranking_snapshot', {
    p_rank_type: PROBE_TYPE,
    p_rows: rows(5),
  })

  check('관리자 호출 성공', error === null, error?.message)
  check('새 snapshot_at 을 돌려준다', typeof data === 'string' && !Number.isNaN(Date.parse(data)))
  check('5행이 적재된다', (await countProbeRows()) === 5)
  check('한 업로드는 스냅샷 하나', (await snapshots()).length === 1)
}

for (let index = 2; index <= 6; index += 1) {
  /* 같은 초에 여러 번 호출하면 now() 가 같아져 유니크 제약에 걸린다.
     실제 업로드는 사람이 하는 일이라 이런 간격이 나지 않는다. */
  await new Promise((resolve) => setTimeout(resolve, 60))
  const { error } = await session.rpc('replace_ranking_snapshot', {
    p_rank_type: PROBE_TYPE,
    p_rows: rows(3, index),
  })

  if (error !== null) {
    check(`${index}번째 업로드 성공`, false, error.message)
  }
}

check('최근 5개 스냅샷만 남는다', (await snapshots()).length === 5, `${(await snapshots()).length}개`)

/* ------------------------------------------------------------- 6. 뒷정리 */
await service.from('rankings').delete().eq('rank_type', PROBE_TYPE)
await service.auth.admin.deleteUser(userId)

check('검증 데이터 정리 완료', (await countProbeRows()) === 0)

const failed = results.filter((result) => !result.passed)

console.log(`\n${results.length - failed.length}/${results.length} 통과`)
process.exit(failed.length === 0 ? 0 : 1)
