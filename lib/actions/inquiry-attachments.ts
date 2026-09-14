import { INQUIRY_ATTACHMENT_REMOVE_FIELD } from '@/lib/constants/support'
import { STORAGE_BUCKETS } from '@/lib/supabase/storage'

import type { TypedSupabaseClient } from '@/lib/supabase/types'
import type { InquiryAttachment } from '@/types/domain'

/**
 * 1:1 문의 첨부의 **삭제·편집**.
 *
 * 업로드는 여기 없다. 2026-09-14 부터 모든 첨부가 브라우저에서 버킷으로 직접 올라가고
 * (`lib/supabase/upload-inquiry-file.ts`), 접수·수정·답장 액션은 올라간 오브젝트를
 * 확정만 한다(`lib/actions/inquiry-uploads.ts`). 남은 일은 "안 쓰게 된 첨부를
 * 지우기"와 "수정 폼이 뺀 첨부 가려내기" 둘이고, 접수·수정·답장이 같은 규칙을 써야
 * 해서 한곳에 모았다.
 *
 * `'use server'` 파일이 아니다 — 서버 액션 파일은 export 가 전부 액션이어야 하므로
 * 헬퍼는 별도 모듈로 둔다. 다른 `lib/actions/*` 와 마찬가지로 `server-only` 도 걸지
 * 않는다(서버 액션에서만 import 되고, 단위 테스트가 이 모듈을 직접 부른다).
 */

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

/** 첨부 편집 결과. `kept` 는 그대로 둘 것, `removed` 는 저장에 성공하면 지울 것. */
export type AttachmentSplit = {
  kept: readonly InquiryAttachment[]
  removed: readonly InquiryAttachment[]
}

/**
 * 수정 폼이 보낸 "삭제" 체크박스를 반영해 기존 첨부를 둘로 가른다.
 *
 * 값이 파일 이름이 아니라 오브젝트 키(path)라, 이름이 같은 파일이 여러 개여도
 * 정확히 하나만 지워진다.
 */
export function splitAttachments(
  attachments: readonly InquiryAttachment[],
  formData: FormData,
): AttachmentSplit {
  const requested = new Set(
    formData
      .getAll(INQUIRY_ATTACHMENT_REMOVE_FIELD)
      .filter((value): value is string => typeof value === 'string'),
  )

  return {
    kept: attachments.filter((attachment) => !requested.has(attachment.path)),
    removed: attachments.filter((attachment) => requested.has(attachment.path)),
  }
}
