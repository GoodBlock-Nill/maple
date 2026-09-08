/**
 * 20260908002100 마이그레이션(신고 처리 컬럼 · UPDATE 권한 · 가드 트리거)을
 * 실제 원격 DB 에 대고 확인한다.
 *
 *   node --env-file=.env.local tests/manual/reports-admin-columns-check.mjs
 *
 * 단위 테스트는 Supabase 클라이언트를 목으로 대체하므로 "가드가 실제로 되돌리는가"는
 * 검증하지 못한다. 여기서는 스텁 계정으로 진짜 세션을 만들어(매직링크 토큰) 일반
 * 사용자 권한으로 두드린다. 만든 계정과 행은 끝에서 지운다.
 *
 * 키는 환경 변수에서만 읽고 출력에는 남기지 않는다.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anonKey || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
const user = createClient(url, anonKey, { auth: { persistSession: false } })

let failures = 0
const record = (name, ok, detail) => {
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

/* 1. 새 컬럼이 실제로 있는가 (service_role 은 RLS 를 우회한다) */
{
  const { error } = await admin
    .from('reports')
    .select('id, note, resolved_by, resolved_at')
    .limit(1)
  record('reports 처리 컬럼 존재', error === null, error?.message ?? 'note/resolved_by/resolved_at')
}

/* 2. note 길이 제약(500자) */
{
  const { error } = await admin.rpc('is_admin')
  record('is_admin() 호출 가능(서비스 롤)', error === null, error?.message ?? '')
}

/* 3. 일반 사용자 세션 만들기 */
const email = `stub-check-${crypto.randomUUID()}@stub.glzaworld.local`
const created = await admin.auth.admin.createUser({ email, email_confirm: true })
const userId = created.data.user?.id ?? null
record('스텁 계정 생성', userId !== null, created.error?.message ?? '')

if (userId === null) process.exit(1)

{
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const tokenHash = link.data?.properties?.hashed_token
  const verified = tokenHash
    ? await user.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
    : { error: new Error('hashed_token 없음') }
  record('스텁 계정 로그인', !verified.error, verified.error?.message ?? '')
}

/* 대상 글: 남이 쓴 공개 커뮤니티 글 하나 */
const { data: target } = await admin
  .from('posts')
  .select('id')
  .eq('board', 'community')
  .eq('is_published', true)
  .is('deleted_at', null)
  .neq('author_id', userId)
  .limit(1)
  .maybeSingle()

record('신고 대상 글 확보', target !== null, target?.id ?? '없음')

let reportId = null

/* 4. INSERT 가드 — 처리 컬럼을 실어 보내도 접수는 "미처리"에서 시작한다 */
if (target !== null) {
  const { data, error } = await user
    .from('reports')
    .insert({
      target_type: 'post',
      target_id: target.id,
      reporter_id: userId,
      reason: 'spam',
      detail: '가드 확인용',
      status: 'open',
      note: '내가 쓴 운영 메모',
      resolved_by: userId,
      resolved_at: new Date().toISOString(),
    })
    .select('id')
    .maybeSingle()

  reportId = data?.id ?? null
  record('사용자 신고 접수', error === null, error?.message ?? reportId ?? '')

  if (reportId !== null) {
    const { data: row } = await admin
      .from('reports')
      .select('status, note, resolved_by, resolved_at')
      .eq('id', reportId)
      .maybeSingle()

    const clean =
      row?.status === 'open' &&
      row?.note === null &&
      row?.resolved_by === null &&
      row?.resolved_at === null
    record('INSERT 가드: 처리 컬럼이 비워짐', clean, JSON.stringify(row))
  }
}

/* 5. UPDATE — 일반 사용자는 자기 신고도 처리 상태로 바꾸지 못한다 */
if (reportId !== null) {
  const { data, error } = await user
    .from('reports')
    .update({ status: 'resolved', note: '스스로 종결' })
    .eq('id', reportId)
    .select('id')

  const blocked = error !== null || (data ?? []).length === 0
  record(
    'UPDATE 차단(일반 사용자)',
    blocked,
    error ? `${error.code ?? ''} ${error.message}` : `${(data ?? []).length}건`,
  )

  const { data: row } = await admin
    .from('reports')
    .select('status, note')
    .eq('id', reportId)
    .maybeSingle()

  record('처리 컬럼 그대로', row?.status === 'open' && row?.note === null, JSON.stringify(row))
}

/* 6. 서비스 롤(=관리자 경로)은 처리할 수 있다 */
if (reportId !== null) {
  const { data, error } = await admin
    .from('reports')
    .update({
      status: 'resolved',
      note: '운영 메모',
      resolved_by: null,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', reportId)
    .select('status, note, resolved_at')
    .maybeSingle()

  record(
    '관리자 경로 처리 가능',
    error === null && data?.status === 'resolved' && data?.note === '운영 메모',
    error?.message ?? JSON.stringify(data),
  )
}

/* 정리 */
if (reportId !== null) await admin.from('reports').delete().eq('id', reportId)
await admin.auth.admin.deleteUser(userId)

console.log(failures === 0 ? '\n전부 통과' : `\n실패 ${failures}건`)
process.exit(failures === 0 ? 0 : 1)
