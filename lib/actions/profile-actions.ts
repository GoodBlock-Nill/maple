'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'

import { accountUniqueViolationFieldErrors } from '@/lib/actions/account-fields'
import { readField, toFieldErrors } from '@/lib/actions/form-state'
import { isUniqueViolation } from '@/lib/actions/pg-error'
import { FEATURES } from '@/lib/constants/features'
import { createClient } from '@/lib/supabase/server'
import { buildUserScopedPath, isUserScopedPath, STORAGE_BUCKETS } from '@/lib/supabase/storage'
import { AVATAR_MIME_EXTENSIONS, validateAvatarFile } from '@/lib/validation/account'
import { ACCOUNT_PATH, linkMswAccountSchema, updateNicknameSchema } from '@/lib/validation/auth'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 마이페이지 v2 서버 액션 — 닉네임 변경 · 월드 계정 연동 · 마케팅 수신 동의.
 *
 * 세 액션 모두 **세션 클라이언트**로 자기 행만 건드린다. 서비스 롤을 쓰면 RLS
 * (`profiles_update_self`)를 건너뛰어, 코드 실수 하나가 곧바로 남의 데이터를 쓰는
 * 길이 된다.
 *
 * v1 의 `updateProfileAction`(이름·아바타·닉네임을 한 폼으로 저장)은 시안 v2 에서
 * 화면이 사라지면서 함께 지웠다 — 남겨 두면 `name` 칸이 없는 폼이 직접 POST 로
 * 호출될 때 이름이 조용히 지워진다.
 */

const LOGIN_PATH = '/login'

const GENERIC_FAILURE_MESSAGE = '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.'
const NICKNAME_SAVED_MESSAGE = '닉네임을 변경했습니다.'
const MSW_LINKED_MESSAGE = '계정이 연동되었습니다'
const MSW_DISABLED_MESSAGE = '월드 계정 연동은 준비 중입니다.'

const LOGIN_REQUIRED_MESSAGE = '로그인 후 이용할 수 있습니다.'
const MISSING_FILE_MESSAGE = '올릴 이미지를 선택해 주세요.'
const UPLOAD_FAILURE_MESSAGE = '이미지를 올리지 못했습니다. 잠시 후 다시 시도해 주세요.'

/**
 * 닉네임 변경(시안 §3.1).
 *
 * 리다이렉트하지 않고 같은 화면에 머문다(성공 문구를 입력 아래에 보여 준다).
 * Next 16 문서상 액션이 `revalidatePath`/`refresh` 를 부르지 않으면 현재 라우트가
 * 다시 렌더되지 않으므로, 헤더의 닉네임까지 갱신되도록 `refresh()` 를 부른다.
 */
export async function updateNicknameAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user === null) {
    redirect(`${LOGIN_PATH}?next=${encodeURIComponent(ACCOUNT_PATH)}`)
  }

  const parsed = updateNicknameSchema.safeParse({ nickname: readField(formData, 'nickname') })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ nickname: parsed.data.nickname })
    .eq('id', user.id)

  if (error !== null) {
    const fieldErrors = isUniqueViolation(error) ? accountUniqueViolationFieldErrors(error) : null

    if (fieldErrors !== null) {
      return { fieldErrors }
    }

    return { formError: GENERIC_FAILURE_MESSAGE }
  }

  refresh()

  return { message: NICKNAME_SAVED_MESSAGE }
}

/**
 * 월드 계정 연동(시안 §4) — `profiles.msw_uid` · `msw_profile_code` 저장.
 *
 * 플래그(`NEXT_PUBLIC_FEATURE_MSW_ACCOUNT_FIELDS`)가 꺼져 있으면 화면의 입력칸도
 * 비활성이지만, 서버 액션은 UI 를 거치지 않는 직접 POST 로도 호출되므로 여기서
 * 한 번 더 막는다.
 *
 * 두 값은 계정마다 유일하다(`profiles_msw_uid_key` · `profiles_msw_profile_code_key`)
 * — 23505 는 사용자가 스스로 풀 수 없는 상황이라 필드별 안내로 바꿔 돌려준다.
 */
export async function updateMswLinkAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!FEATURES.mswAccountFields) {
    return { formError: MSW_DISABLED_MESSAGE }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user === null) {
    redirect(`${LOGIN_PATH}?next=${encodeURIComponent(ACCOUNT_PATH)}`)
  }

  const parsed = linkMswAccountSchema.safeParse({
    mswUid: readField(formData, 'mswUid'),
    mswProfileCode: readField(formData, 'mswProfileCode'),
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ msw_uid: parsed.data.mswUid, msw_profile_code: parsed.data.mswProfileCode })
    .eq('id', user.id)

  if (error !== null) {
    const fieldErrors = isUniqueViolation(error) ? accountUniqueViolationFieldErrors(error) : null

    if (fieldErrors !== null) {
      return { fieldErrors }
    }

    return { formError: GENERIC_FAILURE_MESSAGE }
  }

  refresh()

  return { message: MSW_LINKED_MESSAGE }
}

export type MarketingResult = { ok: true } | { ok: false; message: string }

/**
 * 마케팅 정보 수신 동의(시안 §3.2) — 체크하는 즉시 저장한다.
 *
 * 시안은 채널 구분 없이 체크박스 하나다. DB 는 여전히 SMS·이메일 두 칸
 * (`MARKETING_COLUMN` 대응표)이라 **같은 값을 두 칸에 쓴다** — 동의 = 수신거부
 * 아님(false).
 *
 * 폼 제출이 아니라 인자를 받는 서버 액션이다. 낙관적 UI(즉시 반영 후 실패 시
 * 되돌리기)를 붙이기 쉽고, 카드 안에 폼이 하나 더 생기지 않는다. 값은 서버에서
 * 다시 좁힌다 — 직접 POST 로도 호출될 수 있다.
 */
export async function updateMarketingConsentAction(agreed: boolean): Promise<MarketingResult> {
  if (typeof agreed !== 'boolean') {
    return { ok: false, message: GENERIC_FAILURE_MESSAGE }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user === null) {
    return { ok: false, message: LOGIN_REQUIRED_MESSAGE }
  }

  const optOut = !agreed
  const { error } = await supabase
    .from('profiles')
    .update({ marketing_sms_opt_out: optOut, marketing_email_opt_out: optOut })
    .eq('id', user.id)

  if (error !== null) {
    return { ok: false, message: GENERIC_FAILURE_MESSAGE }
  }

  return { ok: true }
}

export type UploadAvatarResult = { ok: true; url: string } | { ok: false; message: string }

/**
 * 프로필 이미지 업로드.
 *
 * 시안 v2 의 마이페이지에는 아바타 업로더가 없어 **지금은 화면에서 부르지 않는다**
 * — 헤더·드로어가 `profiles.avatar_url` 을 계속 읽고(있으면 사진을 쓴다), 업로더가
 * 다시 붙을 때 규칙(경로·확장자 정리·캐시 무효화)을 다시 짜지 않도록 남겨 둔다.
 *
 * 경로는 `{uid}/avatar.{ext}` 한 자리로 고정한다 — 버킷 정책
 * (`avatars_insert_own`: 첫 세그먼트 = uid)을 만족하면서, 사용자가 사진을 여러 번
 * 바꿔도 오브젝트가 쌓이지 않는다. 대신 같은 URL 이 재사용되므로 캐시가 옛 사진을
 * 계속 보여 준다. 그래서 DB 에는 버전 쿼리(`?v=`)를 붙인 URL 을 저장한다.
 */
export async function uploadAvatarAction(formData: FormData): Promise<UploadAvatarResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user === null) {
    return { ok: false, message: LOGIN_REQUIRED_MESSAGE }
  }

  const file = formData.get('file')

  if (!(file instanceof File)) {
    return { ok: false, message: MISSING_FILE_MESSAGE }
  }

  const check = validateAvatarFile(file)

  if (!check.ok) {
    return { ok: false, message: check.message }
  }

  const extension = AVATAR_MIME_EXTENSIONS[check.mime]
  const path = buildUserScopedPath(user.id, `avatar.${extension}`)

  /* 정책과 같은 판정을 코드에서도 한 번 건다. 경로 조립이 언젠가 바뀌어도
     "남의 폴더에 쓰는" 경로가 조용히 만들어지지 않는다. */
  if (!isUserScopedPath(path, user.id)) {
    return { ok: false, message: UPLOAD_FAILURE_MESSAGE }
  }

  const bucket = supabase.storage.from(STORAGE_BUCKETS.avatars)
  const { error } = await bucket.upload(path, file, { contentType: check.mime, upsert: true })

  if (error !== null) {
    return { ok: false, message: UPLOAD_FAILURE_MESSAGE }
  }

  /* 형식을 바꿔 올리면(png → jpg) 옛 확장자 파일이 남는다. 지우지 않으면 파기
     배치가 훑을 쓰레기가 되고, 공개 버킷이라 옛 사진이 URL 로 계속 살아 있다. */
  const stale = Object.values(AVATAR_MIME_EXTENSIONS)
    .filter((value) => value !== extension)
    .map((value) => buildUserScopedPath(user.id, `avatar.${value}`))

  await bucket.remove(stale)

  const { data } = bucket.getPublicUrl(path)
  const url = `${data.publicUrl}?v=${Date.now()}`

  const { error: saveError } = await supabase
    .from('profiles')
    .update({ avatar_url: url })
    .eq('id', user.id)

  if (saveError !== null) {
    return { ok: false, message: UPLOAD_FAILURE_MESSAGE }
  }

  refresh()

  return { ok: true, url }
}
