/**
 * 소유자의 문의 수정 · 접수 취소 경계를 실제 원격 DB 에 대고 확인한다
 * (마이그레이션 20260908001900: `inquiries_update_own` + `guard_inquiry_owner_update()`).
 *
 * 단위 테스트는 Supabase 클라이언트를 목으로 대체하므로 "정책과 가드가 실제로
 * 막는가"는 검증하지 못한다. 여기서는 임시 사용자 두 명을 만들어
 *   - 접수 대기 문의는 고칠 수 있고,
 *   - 처리 중으로 올라간 문의는 고칠 수 없으며(42501),
 *   - 취소는 되지만 되돌릴 수는 없고,
 *   - 남의 문의는 아예 건드릴 수 없다
 * 는 네 가지를 본다.
 *
 *   node --env-file=.env.local tests/manual/inquiries-owner-edit-check.mjs
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

const results = []
const record = (name, ok, detail) => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

/** 매직링크로 세션을 얻은 사용자 클라이언트를 만든다. */
async function createUserClient(label) {
  const email = `owner-edit-${label}-${crypto.randomUUID()}@stub.glzaworld.local`
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

/** 접수 대기 문의 한 건. 시나리오마다 새로 만든다(한 건에 여러 전이를 섞지 않는다). */
async function createInquiry(title) {
  const { data, error } = await owner.client
    .from('inquiries')
    .insert({
      user_id: owner.id,
      account_id: '123456789000000',
      category: '계정',
      type: '문의',
      title,
      content: '자동 점검 스크립트가 만든 문의입니다.',
      privacy_consent: true,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`문의 생성 실패: ${error.message}`)
  }

  return data.id
}

/** 서비스 롤로 읽은 현재 행. 사용자 클라이언트의 응답만 믿지 않는다. */
async function readRow(id) {
  const { data } = await admin
    .from('inquiries')
    .select('title, status, cancelled_at')
    .eq('id', id)
    .maybeSingle()

  return data
}

const created = []

/* 1. 접수 대기 문의는 소유자가 고칠 수 있다 */
{
  const id = await createInquiry('점검용 문의 A')
  created.push(id)

  const { error } = await owner.client
    .from('inquiries')
    .update({ title: '수정된 제목', content: '수정된 내용입니다.', category: '결제' })
    .eq('id', id)
  const row = await readRow(id)

  record('접수 대기 문의 수정', error === null && row?.title === '수정된 제목', error?.message)
}

/* 2. 처리 중으로 올라간 문의는 고칠 수 없다(가드 42501) */
{
  const id = await createInquiry('점검용 문의 B')
  created.push(id)
  await admin.from('inquiries').update({ status: 'in_progress' }).eq('id', id)

  const { error } = await owner.client
    .from('inquiries')
    .update({ title: '몰래 고친 제목' })
    .eq('id', id)
  const row = await readRow(id)

  record(
    '처리 중 문의 수정 차단',
    error !== null && row?.title === '점검용 문의 B',
    error ? `${error.code ?? ''} ${error.message}`.trim() : '수정됨(!)',
  )

  /* 3. 처리 중이어도 접수 취소는 열려 있다 */
  const cancelledAt = new Date().toISOString()
  const { error: cancelError } = await owner.client
    .from('inquiries')
    .update({ status: 'closed', cancelled_at: cancelledAt })
    .eq('id', id)
  const cancelled = await readRow(id)

  record(
    '처리 중 문의 접수 취소',
    cancelError === null && cancelled?.status === 'closed' && cancelled?.cancelled_at !== null,
    cancelError?.message ?? cancelled?.cancelled_at,
  )

  /* 4. 취소는 되돌릴 수 없다 */
  const { error: undoError } = await owner.client
    .from('inquiries')
    .update({ status: 'pending', cancelled_at: null })
    .eq('id', id)
  const afterUndo = await readRow(id)

  record(
    '취소 해제 차단',
    undoError !== null && afterUndo?.cancelled_at !== null,
    undoError ? `${undoError.code ?? ''} ${undoError.message}`.trim() : '해제됨(!)',
  )
}

/* 5. 소유자가 상태를 답변 완료로 올릴 수는 없다 */
{
  const id = await createInquiry('점검용 문의 C')
  created.push(id)

  const { error } = await owner.client.from('inquiries').update({ status: 'answered' }).eq('id', id)
  const row = await readRow(id)

  record(
    '소유자의 answered 승격 차단',
    error !== null && row?.status === 'pending',
    error ? `${error.code ?? ''} ${error.message}`.trim() : '승격됨(!)',
  )

  /* 6. cancelled_at 만 따로 찍는 것도 막는다(상태와 어긋난 행이 생긴다) */
  const { error: stampError } = await owner.client
    .from('inquiries')
    .update({ cancelled_at: new Date().toISOString() })
    .eq('id', id)
  const stamped = await readRow(id)

  record(
    'cancelled_at 단독 지정 차단',
    stampError !== null && stamped?.cancelled_at === null,
    stampError ? `${stampError.code ?? ''} ${stampError.message}`.trim() : '찍힘(!)',
  )

  /* 7. 남은 문의로 소유자 이전(user_id 변경)도 막는다 */
  const { error: stealError } = await owner.client
    .from('inquiries')
    .update({ user_id: stranger.id })
    .eq('id', id)

  record(
    'user_id 변경 차단',
    stealError !== null,
    stealError ? `${stealError.code ?? ''} ${stealError.message}`.trim() : '변경됨(!)',
  )
}

/* 8. 남의 문의는 건드릴 수 없다(정책이 행 자체를 감춘다 → 0건 갱신) */
{
  const id = created[0]
  const { error } = await stranger.client
    .from('inquiries')
    .update({ title: '남이 고친 제목' })
    .eq('id', id)
  const row = await readRow(id)

  record('타인 문의 수정 차단', row?.title === '수정된 제목', error?.message ?? '0건 갱신')
}

/* 9. 첨부 삭제: 자기 폴더의 오브젝트만 지울 수 있다(수정에서 첨부를 빼는 경로) */
{
  const path = `${owner.id}/${crypto.randomUUID()}-check.png`
  const file = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })
  await owner.client.storage
    .from('inquiry-attachments')
    .upload(path, file, { contentType: 'image/png' })

  const { data: strangerRemoved } = await stranger.client.storage
    .from('inquiry-attachments')
    .remove([path])

  record(
    '타인 첨부 삭제 차단',
    (strangerRemoved ?? []).length === 0,
    `${(strangerRemoved ?? []).length}건 삭제`,
  )

  const { data: ownerRemoved, error: removeError } = await owner.client.storage
    .from('inquiry-attachments')
    .remove([path])

  record(
    '본인 첨부 삭제',
    removeError === null && (ownerRemoved ?? []).length === 1,
    removeError?.message ?? `${(ownerRemoved ?? []).length}건 삭제`,
  )

  await admin.storage.from('inquiry-attachments').remove([path])
}

/* 정리 */
await admin.from('inquiries').delete().in('id', created)
await admin.auth.admin.deleteUser(owner.id)
await admin.auth.admin.deleteUser(stranger.id)

const failed = results.filter((result) => !result.ok)
console.log(`\n${results.length - failed.length}/${results.length} 통과`)
process.exit(failed.length === 0 ? 0 : 1)
