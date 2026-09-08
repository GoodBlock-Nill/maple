/**
 * `inquiries` · `inquiry_replies` · `inquiry-attachments` 의 권한 경계를 실제 원격
 * DB 에 대고 확인한다.
 *
 * 단위 테스트는 Supabase 클라이언트를 목으로 대체하므로 "RLS 가 실제로 막는가"는
 * 검증하지 못한다. 여기서는 임시 사용자 두 명을 실제로 만들어 서로의 문의를
 * 읽을 수 없는지 본다.
 *
 *   node --env-file=.env.local tests/manual/inquiries-rls-check.mjs
 *
 * 키는 환경 변수에서만 읽고 출력에도 남기지 않는다. 만든 계정·문의는 끝에서 지운다.
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

/** 매직링크로 세션을 얻은 사용자 클라이언트를 만든다. */
async function createUserClient(label) {
  const email = `rls-check-${label}-${crypto.randomUUID()}@stub.glzaworld.local`
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { nickname: `검사${label}`, provider: 'kakao' },
  })

  if (createError) {
    throw new Error(`계정 생성 실패: ${createError.message}`)
  }

  const client = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  if (linkError) {
    throw new Error(`매직링크 발급 실패: ${linkError.message}`)
  }

  const { error: verifyError } = await client.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'magiclink',
  })

  if (verifyError) {
    throw new Error(`세션 생성 실패: ${verifyError.message}`)
  }

  return { id: created.user.id, client }
}

const owner = await createUserClient('owner')
const stranger = await createUserClient('stranger')

/* 1. 본인 명의로 문의를 넣을 수 있다 */
const { data: inserted, error: insertError } = await owner.client
  .from('inquiries')
  .insert({
    user_id: owner.id,
    account_id: '123456789000000',
    category: '계정',
    type: '문의',
    title: 'RLS 점검용 문의',
    content: '자동 점검 스크립트가 만든 문의입니다.',
    privacy_consent: true,
    status: 'pending',
  })
  .select('id')
  .single()

record('본인 문의 insert', insertError === null, insertError?.message ?? inserted?.id)

if (insertError) {
  process.exit(1)
}

const inquiryId = inserted.id

/* 2. 본인은 자기 문의를 읽는다 */
{
  const { data, error } = await owner.client
    .from('inquiries')
    .select('id, title, status')
    .eq('id', inquiryId)
    .maybeSingle()
  record('본인 문의 select', error === null && data !== null, error?.message ?? data?.status)
}

/* 3. 남의 문의는 읽히지 않는다 */
{
  const { data, error } = await stranger.client
    .from('inquiries')
    .select('id')
    .eq('id', inquiryId)
    .maybeSingle()
  record('타인 문의 select 차단', error !== null || data === null, error?.message ?? '0건')
}

/* 4. anon 은 아무것도 읽지 못한다 */
{
  const { data, error } = await anon.from('inquiries').select('id').limit(1)
  const denied = error !== null || (data ?? []).length === 0
  record('anon select 차단', denied, error?.message ?? '0건')
}

/* 5. 운영자 답변(서비스 롤로 삽입)은 본인만 읽는다 */
{
  const { error } = await admin.from('inquiry_replies').insert({
    inquiry_id: inquiryId,
    author_name: '운영자',
    content: 'RLS 점검용 답변입니다.',
  })
  record('답변 insert (service_role)', error === null, error?.message)
}

{
  const { data, error } = await owner.client
    .from('inquiry_replies')
    .select('id, author_name, content')
    .eq('inquiry_id', inquiryId)
  record(
    '본인 문의의 답변 select',
    error === null && (data ?? []).length === 1,
    error?.message ?? `${(data ?? []).length}건`,
  )
}

{
  const { data, error } = await stranger.client
    .from('inquiry_replies')
    .select('id')
    .eq('inquiry_id', inquiryId)
  const denied = error !== null || (data ?? []).length === 0
  record('타인 문의의 답변 select 차단', denied, error?.message ?? '0건')
}

/* 6. 첨부 버킷: 남의 폴더에는 못 쓰고, 자기 폴더에 올린 파일만 서명할 수 있다 */
{
  const path = `${owner.id}/${crypto.randomUUID()}-check.png`
  const file = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })
  const { error: uploadError } = await owner.client.storage
    .from('inquiry-attachments')
    .upload(path, file, { contentType: 'image/png' })
  record('본인 폴더 업로드', uploadError === null, uploadError?.message)

  const { error: signError } = await owner.client.storage
    .from('inquiry-attachments')
    .createSignedUrl(path, 60)
  record('본인 첨부 서명 URL', signError === null, signError?.message)

  const { data: strangerSign } = await stranger.client.storage
    .from('inquiry-attachments')
    .createSignedUrl(path, 60)
  record('타인 첨부 서명 차단', strangerSign === null, strangerSign ? '서명됨(!)' : '거절')

  await admin.storage.from('inquiry-attachments').remove([path])
}

/* 정리 */
await admin.from('inquiries').delete().eq('id', inquiryId)
await admin.auth.admin.deleteUser(owner.id)
await admin.auth.admin.deleteUser(stranger.id)

const failed = results.filter((result) => !result.ok)
console.log(`\n${results.length - failed.length}/${results.length} 통과`)
process.exit(failed.length === 0 ? 0 : 1)
