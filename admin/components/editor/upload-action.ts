'use server'

import {
  buildPostImagePath,
  POST_IMAGE_BUCKET,
  validatePostImage,
} from '@/components/editor/post-image'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'

/**
 * 본문 이미지 업로드 서버 액션.
 *
 * `lib/actions/` 가 아니라 에디터 옆에 두는 이유: 이 액션은 뉴스 도메인의 변경이
 * 아니라 **에디터가 동작하기 위한 부속**이다. 유일한 호출부(`use-image-upload.ts`)
 * 와 규칙 정의(`post-image.ts`)가 이 폴더에 있어, 에디터를 다른 모듈이 재사용할 때
 * 폴더 하나만 따라오면 된다.
 *
 * 쿠키를 아는 세션 클라이언트로 올린다 — 서비스 롤을 쓰면 RLS 를 건너뛰어
 * `post_images_insert_own`(경로 첫 세그먼트 = uid) 검사가 사라진다. 최종 방어선은
 * 여기 코드가 아니라 스토리지 정책이고, 코드는 같은 규칙을 미리 맞추는 역할이다.
 *
 * 반환값이 예외가 아니라 판별 유니온인 이유: 에디터는 실패를 인라인 문구로 보여
 * 줘야 하는데, 서버 액션의 예외는 클라이언트에서 익명화되어 문구를 잃는다.
 */
export type UploadImageResult = { ok: true; url: string } | { ok: false; message: string }

export async function uploadPostImageAction(formData: FormData): Promise<UploadImageResult> {
  const actor = await requireAdmin()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return { ok: false, message: '올릴 이미지를 선택해 주세요.' }
  }

  const check = validatePostImage(file)

  if (!check.ok) {
    return { ok: false, message: check.message }
  }

  const supabase = await createClient()
  const path = buildPostImagePath(actor.id, check.mime)
  const { error } = await supabase.storage
    .from(POST_IMAGE_BUCKET)
    .upload(path, file, { contentType: check.mime, upsert: false })

  if (error !== null) {
    console.error('[editor] 이미지 업로드 실패', error.message)

    return { ok: false, message: '이미지를 올리지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }

  const { data } = supabase.storage.from(POST_IMAGE_BUCKET).getPublicUrl(path)

  return { ok: true, url: data.publicUrl }
}
