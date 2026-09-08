'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { readField, toFieldErrors } from '@/lib/actions/form-state'
import { cooldownMessage, remainingCooldown } from '@/lib/actions/rate-limit'
import { getCurrentUser } from '@/lib/auth/current-user'
import { INQUIRY_SUBMITTED_PARAM, MY_INQUIRIES_PATH } from '@/lib/constants/support'
import { createClient } from '@/lib/supabase/server'
import { buildUserScopedPath, isUserScopedPath, STORAGE_BUCKETS } from '@/lib/supabase/storage'
import { createInquirySchema, validateInquiryAttachments } from '@/lib/validation/inquiry'

import type { FormState } from '@/lib/actions/form-state'
import type { TypedSupabaseClient } from '@/lib/supabase/types'
import type { InquiryAttachment } from '@/types/domain'

/**
 * 1:1 문의 접수 서버 액션.
 *
 * 인증은 여기서 다시 확인한다. 프록시의 검사는 낙관적(optimistic)이고, 서버 액션은
 * UI 를 거치지 않는 직접 POST 로도 호출될 수 있다. 최종 권한은 RLS 가 강제한다
 * (`inquiries_insert_own` · `inquiry_attachments_insert_own`).
 */

const LOGIN_MESSAGE = '로그인 후 이용할 수 있습니다.'
const FAILURE_MESSAGE = '문의를 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.'
const UPLOAD_FAILURE_MESSAGE = '첨부파일을 올리지 못했습니다. 잠시 후 다시 시도해 주세요.'

const SUPPORT_PATH = '/support'

/** 사용자의 마지막 접수 시각. 도배 방지 판정에만 쓴다. */
async function getLatestInquiryAt(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('inquiries')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.created_at ?? null
}

/** 폼에서 실제로 선택된 파일만 남긴다. 빈 input 도 File(size 0)로 들어온다. */
function readFiles(formData: FormData, name: string): File[] {
  return formData
    .getAll(name)
    .filter((value): value is File => value instanceof File && value.size > 0)
}

type UploadResult = { ok: true; attachments: InquiryAttachment[] } | { ok: false; message: string }

/**
 * 첨부를 비공개 버킷에 올린다.
 *
 * 파일명 앞에 uuid 를 붙이는 이유는 두 가지다. 같은 이름을 두 번 올렸을 때의
 * 덮어쓰기(=이전 문의의 근거 자료 소실)를 막고, 정책이 요구하는 `{uid}/` 접두사를
 * 유지한 채로도 키가 항상 유일해지기 때문이다. 원본 이름은 DB 메타에 남겨
 * 화면에는 사용자가 올린 그대로 보여 준다.
 */
async function uploadAttachments(
  supabase: TypedSupabaseClient,
  userId: string,
  files: readonly File[],
): Promise<UploadResult> {
  const attachments: InquiryAttachment[] = []

  for (const file of files) {
    const path = buildUserScopedPath(userId, `${crypto.randomUUID()}-${file.name}`)

    /* 정책과 같은 판정을 코드에서도 한 번 건다. 경로 조립이 언젠가 바뀌어도
       "남의 폴더에 쓰는" 경로가 조용히 만들어지지 않는다. */
    if (!isUserScopedPath(path, userId)) {
      return { ok: false, message: UPLOAD_FAILURE_MESSAGE }
    }

    const { error } = await supabase.storage
      .from(STORAGE_BUCKETS.inquiryAttachments)
      .upload(path, file, { contentType: file.type, upsert: false })

    if (error !== null) {
      /* 이미 올라간 파일은 지운다. 남겨 두면 어떤 문의에도 연결되지 않은
         고아 오브젝트가 비공개 버킷에 쌓인다. */
      await removeAttachments(supabase, attachments)

      return { ok: false, message: UPLOAD_FAILURE_MESSAGE }
    }

    attachments.push({ name: file.name, path, size: file.size, mimeType: file.type })
  }

  return { ok: true, attachments }
}

async function removeAttachments(
  supabase: TypedSupabaseClient,
  attachments: readonly InquiryAttachment[],
): Promise<void> {
  if (attachments.length === 0) {
    return
  }

  await supabase.storage
    .from(STORAGE_BUCKETS.inquiryAttachments)
    .remove(attachments.map((attachment) => attachment.path))
}

export async function createInquiry(_prevState: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser()

  if (user === null) {
    return { formError: LOGIN_MESSAGE }
  }

  const parsed = createInquirySchema.safeParse({
    accountId: readField(formData, 'accountId'),
    category: readField(formData, 'category'),
    type: readField(formData, 'type'),
    title: readField(formData, 'title'),
    content: readField(formData, 'content'),
    /* 체크박스는 체크했을 때만 FormData 에 담긴다. 값이 아니라 존재 여부로 판단한다. */
    consent: formData.get('consent') !== null,
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const files = readFiles(formData, 'attachments')
  const attachmentCheck = validateInquiryAttachments(files)

  if (!attachmentCheck.ok) {
    return { fieldErrors: { attachments: attachmentCheck.message } }
  }

  const supabase = await createClient()
  const waitSeconds = remainingCooldown(await getLatestInquiryAt(supabase, user.id))

  if (waitSeconds > 0) {
    return { formError: cooldownMessage(waitSeconds) }
  }

  const uploaded = await uploadAttachments(supabase, user.id, files)

  if (!uploaded.ok) {
    return { formError: uploaded.message }
  }

  const { data, error } = await supabase
    .from('inquiries')
    .insert({
      user_id: user.id,
      account_id: parsed.data.accountId,
      category: parsed.data.category,
      type: parsed.data.type,
      title: parsed.data.title,
      content: parsed.data.content,
      attachments: uploaded.attachments,
      privacy_consent: true,
      /* `inquiries_insert_own` 정책이 pending 만 허용한다. 명시해 두면 기본값이
         바뀌어도 정책과 어긋나지 않는다. */
      status: 'pending',
    })
    .select('id')
    .single()

  if (error !== null || data === null) {
    await removeAttachments(supabase, uploaded.attachments)

    return { formError: FAILURE_MESSAGE }
  }

  revalidatePath(MY_INQUIRIES_PATH)
  revalidatePath(SUPPORT_PATH)

  // redirect() 는 예외를 던지므로 성공 경로의 마지막에서 호출한다.
  redirect(`${MY_INQUIRIES_PATH}/${data.id}?${INQUIRY_SUBMITTED_PARAM}=1`)
}
