import {
  isPostImageMime,
  POST_IMAGE_MAX_BYTES,
  POST_IMAGE_MIME_EXTENSIONS,
} from '@/lib/supabase/storage'

import type { PostImageMime } from '@/lib/supabase/storage'

/**
 * 본문 이미지 업로드 입력 검증.
 *
 * 버킷에도 `allowed_mime_types` · `file_size_limit` 이 걸려 있지만, 거기서 걸리면
 * 사용자는 영문 스토리지 오류만 본다. 같은 규칙을 앞단에서 한 번 더 재서 한국어
 * 안내를 돌려준다. 값은 `lib/supabase/storage.ts` 한 곳에서만 가져오므로 두 규칙이
 * 갈라질 여지가 없다.
 */

const MEGABYTE = 1024 * 1024

export type PostImageCheck = { ok: true; mime: PostImageMime } | { ok: false; message: string }

/** 화면 안내에 쓰는 확장자 목록("JPG · PNG · WEBP · GIF"). */
export const POST_IMAGE_EXTENSION_LABEL = Object.values(POST_IMAGE_MIME_EXTENSIONS)
  .map((extension) => extension.toUpperCase())
  .join(' · ')

export const POST_IMAGE_MAX_MB = Math.floor(POST_IMAGE_MAX_BYTES / MEGABYTE)

export function validatePostImage(file: { type: string; size: number }): PostImageCheck {
  /* 빈 파일은 스토리지가 0바이트 오브젝트로 받아들여 깨진 이미지가 본문에 남는다. */
  if (file.size <= 0) {
    return { ok: false, message: '빈 파일은 올릴 수 없습니다.' }
  }

  if (!isPostImageMime(file.type)) {
    return { ok: false, message: `${POST_IMAGE_EXTENSION_LABEL} 이미지만 올릴 수 있습니다.` }
  }

  if (file.size > POST_IMAGE_MAX_BYTES) {
    return { ok: false, message: `이미지는 ${POST_IMAGE_MAX_MB}MB 이하만 올릴 수 있습니다.` }
  }

  return { ok: true, mime: file.type }
}
