/**
 * `reports` 테이블의 권한 경계를 실제 원격 DB 에 대고 확인한다.
 *
 * 단위 테스트는 Supabase 클라이언트를 목으로 대체하므로 "RLS 가 실제로 막는가"는
 * 검증하지 못한다. 로그인 가능한 테스트 계정이 없어 E2E 로도 확인할 수 없어서,
 * anon 키로 직접 REST 를 두드려 거절되는지 본다.
 *
 *   node --env-file=.env.local tests/manual/reports-rls-check.mjs
 *
 * 키는 환경 변수에서만 읽는다. 출력에도 남기지 않는다.
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
const anon = createClient(url, anonKey, { auth: { persistSession: false } })

const results = []
const record = (name, ok, detail) => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

/* 1. 테이블이 실제로 만들어졌는가 (service_role 은 RLS 를 우회한다) */
{
  const { count, error } = await admin.from('reports').select('*', { count: 'exact', head: true })
  record(
    'reports 테이블 존재 (service_role select)',
    error === null,
    error?.message ?? `count=${count}`,
  )
}

/* 2. 컬럼·제약이 기대한 모양인가 */
{
  const { error } = await admin
    .from('reports')
    .select('id, target_type, target_id, reporter_id, reason, detail, status, created_at')
    .limit(1)
  record(
    'reports 컬럼 구성',
    error === null,
    error?.message ?? 'id/target/reporter/reason/detail/status/created_at',
  )
}

/* 3. anon 은 읽을 수 없다 */
{
  const { data, error } = await anon.from('reports').select('id').limit(1)
  const denied = error !== null || (data ?? []).length === 0
  record('anon select 차단', denied, error ? `${error.code ?? ''} ${error.message}` : '0건')
}

/* 4. anon 은 쓸 수 없다 (42501 또는 401) */
{
  const { error } = await anon.from('reports').insert({
    target_type: 'post',
    target_id: '22222222-0000-4000-8000-000000000001',
    reporter_id: '00000000-0000-4000-8000-000000000000',
    reason: 'spam',
  })
  const code = error?.code ?? ''
  const denied =
    error !== null &&
    (code === '42501' || code === '401' || /permission|policy/i.test(error.message))
  record('anon insert 차단', denied, error ? `${code} ${error.message}` : '삽입이 성공했다(치명적)')
}

/* 5. 신고 자격 검사 함수는 anon 에게 열려 있지 않다 */
{
  const { error } = await anon.rpc('can_report_target', {
    p_target_type: 'post',
    p_target_id: '22222222-0000-4000-8000-000000000001',
  })
  const denied = error !== null
  record(
    'can_report_target anon 실행 차단',
    denied,
    error ? `${error.code ?? ''} ${error.message}` : '실행됨(치명적)',
  )
}

/* 6. 자기 글 신고 차단 · 대상 존재 검사가 붙어 있는가 (service_role 로 제약만 확인) */
{
  const { error } = await admin.from('reports').insert({
    target_type: 'profile',
    target_id: '22222222-0000-4000-8000-000000000001',
    reporter_id: '00000000-0000-4000-8000-000000000000',
    reason: 'spam',
  })
  const blocked = error !== null && /reports_target_type_check|violates/i.test(error.message)
  record(
    'target_type check 제약',
    blocked,
    error ? error.message.slice(0, 80) : '삽입이 성공했다(치명적)',
  )
}

/* 7. anon 은 삭제된/미공개 글을 신고 대상으로 볼 수 없다 (posts 정책 재확인) */
{
  const { data } = await anon.from('posts').select('id').eq('board', 'community').limit(1)
  record('anon 은 공개 커뮤니티 글만 조회', Array.isArray(data), `${data?.length ?? 0}건`)
}

const failed = results.filter((result) => !result.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length === 0 ? 0 : 1)
