import 'server-only'

import { createClient } from '@/lib/supabase/server'

/**
 * 문의 첨부(비공개 버킷 `inquiry-attachments`) 읽기.
 *
 * 목록/상세 조회(lib/data/inquiries.ts)와 파일을 나눈 이유는 파일 길이 상한(300줄)
 * 때문이다. 첨부는 jsonb 해석 + 서명 URL 발급이라는 독립된 관심사이기도 하다.
 */

/** 서명 URL 수명. 상세를 열어 둔 채 받는 정도면 충분하고, 길수록 유출된 링크가 오래 산다. */
const SIGNED_URL_TTL_SECONDS = 300

const ATTACHMENT_BUCKET = 'inquiry-attachments'

export type InquiryAttachment = {
  name: string
  path: string
  size: number
  mimeType: string
  /** 서명에 실패하면 null. 화면은 링크 대신 안내를 그린다. */
  url: string | null
}

type ParsedAttachment = Omit<InquiryAttachment, 'url'>

/**
 * jsonb 첨부를 한 건씩 좁힌다.
 *
 * 값의 모양은 접수 시점의 사용자 사이트 코드가 정한다. 모르는 형태가 섞여 있어도
 * 상세 화면이 죽지 않도록 실패한 원소는 버린다.
 */
export function toAttachments(value: unknown): readonly ParsedAttachment[] {
  if (!Array.isArray(value)) {
    return []
  }

  const parsed: ParsedAttachment[] = []

  for (const item of value) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      continue
    }

    const record = item as Record<string, unknown>
    const path = typeof record.path === 'string' ? record.path : ''

    if (path === '') {
      continue
    }

    parsed.push({
      name: typeof record.name === 'string' && record.name !== '' ? record.name : path,
      path,
      size: typeof record.size === 'number' ? record.size : 0,
      mimeType: typeof record.mimeType === 'string' ? record.mimeType : '',
    })
  }

  return parsed
}

/**
 * 서명 URL 발급.
 *
 * 서비스 롤이 아니라 세션 클라이언트로 서명한다 — `inquiry_attachments_read_own`
 * 정책이 "작성자 본인 또는 관리자"를 다시 검사하므로, 관리자 권한이 사라진 세션은
 * 서명 자체를 받지 못한다.
 */
export async function signInquiryAttachments(
  attachments: readonly ParsedAttachment[],
): Promise<readonly InquiryAttachment[]> {
  if (attachments.length === 0) {
    return []
  }

  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrls(
      attachments.map((attachment) => attachment.path),
      SIGNED_URL_TTL_SECONDS,
    )

  const signed = new Map<string, string>()

  if (error === null && data !== null) {
    for (const item of data) {
      if (item.error === null && item.path !== null && typeof item.signedUrl === 'string') {
        signed.set(item.path, item.signedUrl)
      }
    }
  }

  return attachments.map((attachment) => ({
    ...attachment,
    url: signed.get(attachment.path) ?? null,
  }))
}
