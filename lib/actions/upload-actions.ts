'use server'

import {
  remainingCooldown,
  UPLOAD_MAX_PER_WINDOW,
  UPLOAD_WINDOW_SECONDS,
  uploadLimitMessage,
} from '@/lib/actions/rate-limit'
import { getCurrentUser } from '@/lib/auth/current-user'
import { createClient } from '@/lib/supabase/server'
import {
  buildPostImagePath,
  isUserScopedPath,
  postImageFolder,
  STORAGE_BUCKETS,
} from '@/lib/supabase/storage'
import { validatePostImage } from '@/lib/validation/upload'

import type { TypedSupabaseClient } from '@/lib/supabase/types'

/**
 * 커뮤니티 본문 이미지 업로드.
 *
 * 쿠키를 아는 클라이언트로 올린다 — 서비스 롤을 쓰면 RLS 를 건너뛰어
 * `post_images_insert_own`(경로 첫 세그먼트 = uid) 검사가 사라진다. 즉 이 액션의
 * 최종 방어선은 여기 코드가 아니라 스토리지 정책이고, 코드는 같은 규칙을 미리
 * 맞춰 주는 역할이다.
 *
 * 반환값은 예외가 아니라 판별 유니온이다. 에디터는 업로드 실패를 인라인 문구로
 * 보여 줘야 하고, 서버 액션의 예외는 클라이언트에서 익명화되어 문구를 잃는다.
 */

const LOGIN_MESSAGE = '로그인 후 이용할 수 있습니다.'
const MISSING_FILE_MESSAGE = '올릴 이미지를 선택해 주세요.'
const FAILURE_MESSAGE = '이미지를 올리지 못했습니다. 잠시 후 다시 시도해 주세요.'

export type UploadPostImageResult = { ok: true; url: string } | { ok: false; message: string }

/**
 * 최근 창 안에서 업로드 한도를 넘겼는지 본다.
 *
 * 가장 최근 `UPLOAD_MAX_PER_WINDOW` 개를 가져와, 그 마지막(=가장 오래된) 항목이
 * 아직 창 안에 있으면 한도를 채운 것이다. 개수가 한도에 못 미치면 볼 것도 없다.
 */
async function remainingUploadCooldown(
  supabase: TypedSupabaseClient,
  folder: string,
): Promise<number> {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKETS.postImages).list(folder, {
    limit: UPLOAD_MAX_PER_WINDOW,
    sortBy: { column: 'created_at', order: 'desc' },
  })

  if (error !== null || data === null || data.length < UPLOAD_MAX_PER_WINDOW) {
    return 0
  }

  return remainingCooldown(data[data.length - 1]?.created_at, Date.now(), UPLOAD_WINDOW_SECONDS)
}

export async function uploadPostImage(formData: FormData): Promise<UploadPostImageResult> {
  const user = await getCurrentUser()

  if (user === null) {
    return { ok: false, message: LOGIN_MESSAGE }
  }

  const file = formData.get('file')

  if (!(file instanceof File)) {
    return { ok: false, message: MISSING_FILE_MESSAGE }
  }

  const check = validatePostImage(file)

  if (!check.ok) {
    return { ok: false, message: check.message }
  }

  const supabase = await createClient()
  const folder = postImageFolder(user.id, new Date().getFullYear())
  const waitSeconds = await remainingUploadCooldown(supabase, folder)

  if (waitSeconds > 0) {
    return { ok: false, message: uploadLimitMessage(waitSeconds) }
  }

  const path = buildPostImagePath({
    userId: user.id,
    mime: check.mime,
    id: crypto.randomUUID(),
    year: new Date().getFullYear(),
  })

  /* 정책과 같은 판정을 코드에서도 한 번 건다. 경로 조립이 언젠가 바뀌어도
     "남의 폴더에 쓰는" 경로가 조용히 만들어지지 않는다. */
  if (!isUserScopedPath(path, user.id)) {
    return { ok: false, message: FAILURE_MESSAGE }
  }

  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.postImages)
    .upload(path, file, { contentType: check.mime, upsert: false })

  if (error !== null) {
    return { ok: false, message: FAILURE_MESSAGE }
  }

  const { data } = supabase.storage.from(STORAGE_BUCKETS.postImages).getPublicUrl(path)

  return { ok: true, url: data.publicUrl }
}
