/**
 * 본문 이미지의 형식·크기·저장 경로 규칙.
 *
 * 에디터(클라이언트 검증)와 업로드 서버 액션이 **같은 값**을 써야 하므로 한곳에 둔다.
 * 값 자체는 버킷 정의(`supabase/migrations/20260908000800_storage_buckets.sql`)의
 * `allowed_mime_types` · `file_size_limit` 과 1:1 로 맞춘 것이다.
 */

export const POST_IMAGE_BUCKET = 'post-images'

/**
 * 확장자는 서버가 MIME 에서 정한다 — 사용자가 보낸 파일명은 MIME 과 다를 수 있고,
 * 확장자가 틀리면 스토리지가 content-type 을 잘못 추론해 이미지가 다운로드로 떨어진다.
 */
export const POST_IMAGE_MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
} as const

export type PostImageMime = keyof typeof POST_IMAGE_MIME_EXTENSIONS

export const POST_IMAGE_MAX_BYTES = 5 * 1024 * 1024

const MEGABYTE = 1024 * 1024

export const POST_IMAGE_MAX_MB = Math.floor(POST_IMAGE_MAX_BYTES / MEGABYTE)

/** 파일 선택창의 accept 속성. */
export const POST_IMAGE_ACCEPT = Object.keys(POST_IMAGE_MIME_EXTENSIONS).join(',')

const EXTENSION_LABEL = Object.values(POST_IMAGE_MIME_EXTENSIONS)
  .map((extension) => extension.toUpperCase())
  .join(' · ')

export function isPostImageMime(value: string): value is PostImageMime {
  return Object.hasOwn(POST_IMAGE_MIME_EXTENSIONS, value)
}

export type PostImageCheck = { ok: true; mime: PostImageMime } | { ok: false; message: string }

/**
 * 버킷에도 같은 제한이 걸려 있지만 거기서 걸리면 영문 스토리지 오류만 보인다.
 * 앞단에서 한 번 더 재서 한국어 안내를 돌려준다.
 */
export function validatePostImage(file: { type: string; size: number }): PostImageCheck {
  if (file.size <= 0) {
    return { ok: false, message: '빈 파일은 올릴 수 없습니다.' }
  }

  if (!isPostImageMime(file.type)) {
    return { ok: false, message: `${EXTENSION_LABEL} 이미지만 올릴 수 있습니다.` }
  }

  if (file.size > POST_IMAGE_MAX_BYTES) {
    return { ok: false, message: `이미지는 ${POST_IMAGE_MAX_MB}MB 이하만 올릴 수 있습니다.` }
  }

  return { ok: true, mime: file.type }
}

/**
 * `{uid}/{yyyy}/{uuid}.{ext}` — 스토리지 정책이 요구하는 유일한 형태다.
 *
 * `post_images_insert_own` 은 **경로 첫 세그먼트가 업로더 uid** 인지만 본다
 * (`(storage.foldername(name))[1] = auth.uid()::text`). 관리자도 예외가 아니므로
 * `admin/…` 같은 접두사를 쓰면 업로드가 정책에서 거부된다.
 *
 * 원본 파일명은 버린다: 파일명 자체가 개인정보인 경우가 있고, 같은 이름을 두 번
 * 올리면 덮어쓰기가 난다. 연도 폴더는 목록 조회 범위를 좁혀 준다.
 */
export function buildPostImagePath(
  userId: string,
  mime: PostImageMime,
  now: Date = new Date(),
): string {
  if (userId.trim() === '') {
    throw new Error('업로드 경로를 만들려면 사용자 id 가 필요합니다.')
  }

  return `${userId}/${now.getFullYear()}/${crypto.randomUUID()}.${POST_IMAGE_MIME_EXTENSIONS[mime]}`
}
