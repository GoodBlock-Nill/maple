import { buildUserScopedPath, isUserScopedPath, STORAGE_BUCKETS } from '@/lib/supabase/storage'

import type { TypedSupabaseClient } from '@/lib/supabase/types'
import type { InquiryAttachment } from '@/types/domain'

/**
 * 1:1 문의 첨부의 업로드·삭제.
 *
 * 접수(`inquiry-actions`)와 수정(`inquiry-edit-actions`)이 **같은 경로 규칙**을
 * 써야 해서 한곳에 모았다. 규칙이 갈리면 한쪽이 정책(`{uid}/` 접두사)을 벗어난
 * 키를 만들어도 다른 쪽 테스트는 계속 통과한다.
 *
 * `'use server'` 파일이 아니다 — 서버 액션 파일은 export 가 전부 액션이어야 하므로
 * 헬퍼는 별도 모듈로 둔다. 다른 `lib/actions/*` 와 마찬가지로 `server-only` 도 걸지
 * 않는다(서버 액션에서만 import 되고, 단위 테스트가 이 모듈을 직접 부른다).
 */

export const UPLOAD_FAILURE_MESSAGE = '첨부파일을 올리지 못했습니다. 잠시 후 다시 시도해 주세요.'

export type UploadResult =
  { ok: true; attachments: InquiryAttachment[] } | { ok: false; message: string }

/** 폼에서 실제로 선택된 파일만 남긴다. 빈 input 도 File(size 0)로 들어온다. */
export function readFiles(formData: FormData, name: string): File[] {
  return formData
    .getAll(name)
    .filter((value): value is File => value instanceof File && value.size > 0)
}

/**
 * 첨부를 비공개 버킷에 올린다.
 *
 * 파일명 앞에 uuid 를 붙이는 이유는 두 가지다. 같은 이름을 두 번 올렸을 때의
 * 덮어쓰기(=이전 문의의 근거 자료 소실)를 막고, 정책이 요구하는 `{uid}/` 접두사를
 * 유지한 채로도 키가 항상 유일해지기 때문이다. 원본 이름은 DB 메타에 남겨
 * 화면에는 사용자가 올린 그대로 보여 준다.
 */
export async function uploadAttachments(
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

export async function removeAttachments(
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
