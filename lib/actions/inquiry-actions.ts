'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { readField, toFieldErrors } from '@/lib/actions/form-state'
import { readFiles, removeAttachments, uploadAttachments } from '@/lib/actions/inquiry-attachments'
import {
  claimFormVideos,
  readPendingVideos,
  VIDEO_FORM_INVALID_MESSAGE,
} from '@/lib/actions/inquiry-videos'
import { cooldownMessage, remainingCooldown } from '@/lib/actions/rate-limit'
import { getCurrentUser } from '@/lib/auth/current-user'
import { DEFAULT_INQUIRY_KIND, INQUIRY_KIND_MAP, isInquiryKind } from '@/lib/constants/inquiry-kind'
import { INQUIRY_SUBMITTED_PARAM, MY_INQUIRIES_PATH } from '@/lib/constants/support'
import { getInquiryCategories } from '@/lib/data/inquiry-categories'
import { createClient } from '@/lib/supabase/server'
import { createInquirySchema, validateInquiryAttachments } from '@/lib/validation/inquiry'

import type { FormState } from '@/lib/actions/form-state'
import type { InquiryKind } from '@/lib/constants/inquiry-kind'
import type { TypedSupabaseClient } from '@/lib/supabase/types'

/**
 * 접수 서버 액션 — 1:1 문의 · 버그제보 · 불법이용제보.
 *
 * 세 창구는 같은 폼·같은 규칙을 쓰고 **창구(kind) 하나만** 다르다. kind 는 폼 필드가
 * 아니라 bind 로 실어 받는다(필드로 두면 직접 POST 하나로 창구를 갈아 끼울 수 있다).
 *
 * 인증은 여기서 다시 확인한다. 프록시의 검사는 낙관적(optimistic)이고, 서버 액션은
 * UI 를 거치지 않는 직접 POST 로도 호출될 수 있다. 최종 권한은 RLS 가 강제한다
 * (`inquiries_insert_own` · `inquiry_attachments_insert_own`).
 *
 * 접수 후의 수정 · 접수 취소는 `inquiry-edit-actions.ts` 가 맡는다.
 */

const LOGIN_MESSAGE = '로그인 후 이용할 수 있습니다.'
const FAILURE_MESSAGE = '접수하지 못했습니다. 잠시 후 다시 시도해 주세요.'

/** 사용자의 마지막 접수 시각. 도배 판정에만 쓴다. */
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

export async function createInquiry(
  /** 접수 창구. 폼이 `createInquiry.bind(null, kind)` 로 실어 보낸다. */
  kind: InquiryKind,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser()

  if (user === null) {
    return { formError: LOGIN_MESSAGE }
  }

  /* bind 인자는 Next 가 서명해 보내지만, 값의 모양까지 보장하지는 않는다. 모르는
     창구는 기본 창구로 떨어뜨린다 — 접수를 막기보다 사람이 보는 곳에 남긴다. */
  const safeKind = isInquiryKind(kind) ? kind : DEFAULT_INQUIRY_KIND

  /* 허용 카테고리와 그 카테고리의 세부 유형은 DB(`inquiry_categories`)가 소유하고,
     창구마다 목록이 다르다(kind).
     폼이 보낸 값을 그대로 믿지 않고 여기서 활성 목록과 대조한다 — 이 액션은 UI 를
     거치지 않는 직접 POST 로도 호출된다. 유형은 **고른 카테고리에 매달린 목록**이라
     카테고리와 함께 봐야 한다(`lib/utils/inquiry-subtypes.ts`). */
  const parsed = createInquirySchema(await getInquiryCategories(safeKind)).safeParse({
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
  /* 영상은 본문에 실려 오지 않는다 — 브라우저가 버킷에 직접 올리고 폼은 경로만
     싣는다(`lib/supabase/upload-inquiry-video.ts`). 여기서는 개수만 함께 세고,
     경로의 진위는 아래 `claimFormVideos` 가 스토리지에 다시 물어본다. */
  const videos = readPendingVideos(formData)

  if (videos === null) {
    return { fieldErrors: { attachments: VIDEO_FORM_INVALID_MESSAGE } }
  }

  const attachmentCheck = validateInquiryAttachments(files, 0, videos.length)

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

  const claimed = await claimFormVideos(user.id, videos)

  if (!claimed.ok) {
    await removeAttachments(supabase, uploaded.attachments)

    return { fieldErrors: { attachments: claimed.message } }
  }

  const { data, error } = await supabase
    .from('inquiries')
    .insert({
      user_id: user.id,
      account_id: parsed.data.accountId,
      /* 트리거(`inquiries_set_kind_from_category`)가 카테고리 라벨로 다시 정하지만
         명시한다 — 이 행이 어느 창구로 들어왔는지 코드에서도 읽혀야 한다. */
      kind: safeKind,
      category: parsed.data.category,
      type: parsed.data.type,
      title: parsed.data.title,
      content: parsed.data.content,
      attachments: [...uploaded.attachments, ...claimed.claim.attachments],
      privacy_consent: true,
      /* `inquiries_insert_own` 정책이 pending 만 허용한다. 명시해 두면 기본값이
         바뀌어도 정책과 어긋나지 않는다. */
      status: 'pending',
    })
    .select('id')
    .single()

  if (error !== null || data === null) {
    await removeAttachments(supabase, uploaded.attachments)
    await claimed.claim.rollback()

    return { formError: FAILURE_MESSAGE }
  }

  revalidatePath(MY_INQUIRIES_PATH)
  revalidatePath(INQUIRY_KIND_MAP[safeKind].path)

  // redirect() 는 예외를 던지므로 성공 경로의 마지막에서 호출한다.
  redirect(`${MY_INQUIRIES_PATH}/${data.id}?${INQUIRY_SUBMITTED_PARAM}=1`)
}
