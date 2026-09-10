'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  accountUniqueViolationFieldErrors,
  mswAccountFieldsForWrite,
} from '@/lib/actions/account-fields'
import { readField, toFieldErrors } from '@/lib/actions/form-state'
import { isUniqueViolation } from '@/lib/actions/pg-error'
import { createClient } from '@/lib/supabase/server'
import { buildUserScopedPath, isUserScopedPath, STORAGE_BUCKETS } from '@/lib/supabase/storage'
import {
  AVATAR_MIME_EXTENSIONS,
  isMarketingChannel,
  MARKETING_COLUMN,
  updateProfileSchema,
  validateAvatarFile,
} from '@/lib/validation/account'
import { ACCOUNT_PATH } from '@/lib/validation/auth'

import type { FormState } from '@/lib/actions/form-state'
import type { MarketingChannel } from '@/lib/validation/account'

/**
 * 마이페이지 "계정 관리" 서버 액션 — 프로필 저장 · 이미지 업로드 · 마케팅 수신.
 *
 * 비밀번호 변경은 재인증까지 필요해 `lib/actions/password-actions.ts` 가 맡는다
 * (파일 300줄 한도).
 *
 * 세 액션 모두 **세션 클라이언트**로 자기 행만 건드린다. 서비스 롤을 쓰면 RLS
 * (`profiles_update_self` · `avatars_insert_own`)를 건너뛰어, 코드 실수 하나가
 * 곧바로 남의 데이터를 쓰는 길이 된다.
 */

const LOGIN_PATH = '/login'

const GENERIC_FAILURE_MESSAGE = '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.'
const PROFILE_SAVED_MESSAGE = '프로필을 저장했습니다.'

const LOGIN_REQUIRED_MESSAGE = '로그인 후 이용할 수 있습니다.'
const MISSING_FILE_MESSAGE = '올릴 이미지를 선택해 주세요.'
const UPLOAD_FAILURE_MESSAGE = '이미지를 올리지 못했습니다. 잠시 후 다시 시도해 주세요.'

/**
 * 이름·닉네임(+ 플래그가 켜졌을 때만 월드 계정) 저장.
 *
 * 리다이렉트하지 않고 같은 화면에 머문다(성공 문구를 보여 줘야 한다). Next 16
 * 문서상 액션이 `revalidatePath`/`refresh` 를 부르지 않으면 현재 라우트가 다시
 * 렌더되지 않으므로, 헤더의 닉네임까지 갱신되도록 `refresh()` 를 부른다.
 */
export async function updateProfileAction(
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

  const parsed = updateProfileSchema.safeParse({
    name: readField(formData, 'name'),
    nickname: readField(formData, 'nickname'),
    mswUid: readField(formData, 'mswUid'),
    mswProfileCode: readField(formData, 'mswProfileCode'),
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      /* 빈 칸은 `null` 로 저장한다. 한 번 적은 이름을 지울 수 있어야 하고,
         빈 문자열을 넣으면 "이름이 있는데 비어 있는" 행이 남는다. */
      name: parsed.data.name === '' ? null : parsed.data.name,
      nickname: parsed.data.nickname,
      ...mswAccountFieldsForWrite(parsed.data),
    })
    .eq('id', user.id)

  if (error !== null) {
    const fieldErrors = isUniqueViolation(error) ? accountUniqueViolationFieldErrors(error) : null

    if (fieldErrors !== null) {
      return { fieldErrors }
    }

    return { formError: GENERIC_FAILURE_MESSAGE }
  }

  refresh()

  return { message: PROFILE_SAVED_MESSAGE }
}

export type UploadAvatarResult = { ok: true; url: string } | { ok: false; message: string }

/**
 * 프로필 이미지 업로드.
 *
 * 경로는 `{uid}/avatar.{ext}` 한 자리로 고정한다 — 버킷 정책
 * (`avatars_insert_own`: 첫 세그먼트 = uid)을 만족하면서, 사용자가 사진을 여러 번
 * 바꿔도 오브젝트가 쌓이지 않는다. 대신 같은 URL 이 재사용되므로 캐시가 옛 사진을
 * 계속 보여 준다. 그래서 DB 에는 버전 쿼리(`?v=`)를 붙인 URL 을 저장한다.
 *
 * 반환값이 예외가 아니라 판별 유니온인 이유는 업로더가 실패 사유를 인라인 문구로
 * 보여 줘야 하기 때문이다 — 서버 액션의 예외는 클라이언트에서 익명화된다.
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

export type MarketingResult = { ok: true } | { ok: false; message: string }

/**
 * 마케팅 수신거부 토글 — 체크하는 즉시 저장한다.
 *
 * 폼 제출이 아니라 인자를 받는 서버 액션이다. 체크박스 하나마다 폼을 두면 카드
 * 안에 폼이 두 개 생기고, 낙관적 UI(즉시 반영 후 실패 시 되돌리기)를 붙이기도
 * 어렵다. 값은 서버에서 다시 좁힌다 — 직접 POST 로도 호출될 수 있다.
 */
export async function updateMarketingAction(
  channel: MarketingChannel,
  optOut: boolean,
): Promise<MarketingResult> {
  if (!isMarketingChannel(channel) || typeof optOut !== 'boolean') {
    return { ok: false, message: GENERIC_FAILURE_MESSAGE }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user === null) {
    return { ok: false, message: LOGIN_REQUIRED_MESSAGE }
  }

  /* 계산된 키(`{ [column]: value }`)로 만들면 타입이 `{ [x: string]: boolean }` 으로
     넓어져 supabase-js 의 Update 타입을 통과하지 못한다. 대응표를 근거로 갈라
     리터럴 두 개 중 하나를 고른다. */
  const payload =
    MARKETING_COLUMN[channel] === 'marketing_sms_opt_out'
      ? { marketing_sms_opt_out: optOut }
      : { marketing_email_opt_out: optOut }

  const { error } = await supabase.from('profiles').update(payload).eq('id', user.id)

  if (error !== null) {
    return { ok: false, message: GENERIC_FAILURE_MESSAGE }
  }

  return { ok: true }
}
