/**
 * `post_likes` 의 권한 경계와 집계 트리거를 실제 원격 DB 에 대고 확인한다.
 *
 * 단위 테스트는 Supabase 클라이언트를 목으로 대체하므로 "RLS 가 실제로 막는가",
 * "트리거가 정말 like_count 를 움직이는가"는 검증하지 못한다. anon 키로 직접
 * REST 를 두드려 보고, 서비스 롤로 행을 넣었다 지우며 집계를 확인한다.
 *
 *   node --env-file=.env.local tests/manual/post-likes-rls-check.mjs
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

const POST_ID = '22222222-0000-4000-8000-000000000001'

const results = []
const record = (name, ok, detail) => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

/* 1. 테이블이 실제로 만들어졌는가 (service_role 은 RLS 를 우회한다) */
{
  const { count, error } = await admin
    .from('post_likes')
    .select('*', { count: 'exact', head: true })
  record(
    'post_likes 테이블 존재 (service_role select)',
    error === null,
    error?.message ?? `count=${count}`,
  )
}

/* 2. 컬럼 구성 */
{
  const { error } = await admin.from('post_likes').select('post_id, user_id, created_at').limit(1)
  record('post_likes 컬럼 구성', error === null, error?.message ?? 'post_id/user_id/created_at')
}

/* 3. anon 은 읽을 수 없다 */
{
  const { data, error } = await anon.from('post_likes').select('post_id').limit(1)
  const denied = error !== null || (data ?? []).length === 0
  record('anon select 차단', denied, error ? `${error.code ?? ''} ${error.message}` : '0건')
}

/* 4. anon 은 쓸 수 없다 (42501 = RLS/권한 위반) */
{
  const { error } = await anon.from('post_likes').insert({
    post_id: POST_ID,
    user_id: '00000000-0000-4000-8000-000000000000',
  })
  const code = error?.code ?? ''
  const denied =
    error !== null &&
    (code === '42501' || code === '401' || /permission|policy/i.test(error.message))
  record('anon insert 차단', denied, error ? `${code} ${error.message}` : '삽입이 성공했다(치명적)')
}

/* 5. anon 은 지울 수도 없다 (권한 자체가 회수돼 있다) */
{
  const { error } = await anon.from('post_likes').delete().eq('post_id', POST_ID)
  const denied = error !== null
  record(
    'anon delete 차단',
    denied,
    error ? `${error.code ?? ''} ${error.message}` : '삭제 요청이 통과했다(치명적)',
  )
}

/* 6. 트리거 함수는 SECURITY DEFINER 지만 직접 호출 경로가 없다 */
{
  const { error } = await anon.rpc('sync_post_like_count')
  const denied = error !== null
  record(
    'sync_post_like_count RPC 미노출',
    denied,
    error ? `${error.code ?? ''} ${error.message.slice(0, 60)}` : '호출됐다(치명적)',
  )
}

/* 7. 집계 트리거가 실제로 도는가 (service_role 로 넣었다 지운다) */
{
  const { data: profile } = await admin.from('profiles').select('id').limit(1).maybeSingle()

  if (!profile) {
    record('like_count 동기화 트리거', false, '프로필이 하나도 없어 확인할 수 없다')
  } else {
    const readCount = async () => {
      const { data } = await admin
        .from('posts')
        .select('like_count')
        .eq('id', POST_ID)
        .maybeSingle()

      return data?.like_count ?? null
    }

    const before = await readCount()
    await admin.from('post_likes').delete().eq('post_id', POST_ID).eq('user_id', profile.id)

    const { error: insertError } = await admin
      .from('post_likes')
      .insert({ post_id: POST_ID, user_id: profile.id })
    const afterInsert = await readCount()

    await admin.from('post_likes').delete().eq('post_id', POST_ID).eq('user_id', profile.id)
    const afterDelete = await readCount()

    const ok =
      insertError === null && afterInsert === (before ?? 0) + 1 && afterDelete === (before ?? 0)
    record(
      'like_count 동기화 트리거 (+1 / -1)',
      ok,
      insertError?.message ?? `${before} → ${afterInsert} → ${afterDelete}`,
    )
  }
}

/* 8. 같은 사용자가 두 번 넣을 수 없다 (복합 PK) */
{
  const { data: profile } = await admin.from('profiles').select('id').limit(1).maybeSingle()

  if (!profile) {
    record('중복 좋아요 차단', false, '프로필이 하나도 없어 확인할 수 없다')
  } else {
    await admin.from('post_likes').insert({ post_id: POST_ID, user_id: profile.id })
    const { error } = await admin
      .from('post_likes')
      .insert({ post_id: POST_ID, user_id: profile.id })
    await admin.from('post_likes').delete().eq('post_id', POST_ID).eq('user_id', profile.id)

    const blocked = error !== null && (error.code === '23505' || /duplicate/i.test(error.message))
    record(
      '중복 좋아요 차단 (복합 PK)',
      blocked,
      error ? `${error.code ?? ''} ${error.message.slice(0, 60)}` : '두 번 들어갔다(치명적)',
    )
  }
}

const failed = results.filter((result) => !result.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length === 0 ? 0 : 1)
