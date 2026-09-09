/**
 * 첨부 저장 — 제공자의 내려받기 주소에서 바이트를 받아 `inquiry-attachments` 버킷에 올린다.
 *
 * 경로는 `email/<inquiryId>/<n>-<안전한 이름>`. 웹 문의는 `<uid>/…` 라 접두사만 봐도 출처가
 * 갈린다. 관리자 읽기 정책(is_admin)이 경로를 가리지 않으므로 콘솔은 그대로 서명 URL 을 받는다.
 *
 * 실패는 문의 접수를 되돌리지 않는다 — 본문이 이미 들어온 문의를 첨부 하나 때문에 버리면
 * 사용자는 "메일을 보냈는데 답이 없다"를 겪는다. 실패한 파일은 본문에 이름만 남긴다.
 */

import {
  MAX_ATTACHMENT_BYTES,
  appendAttachmentNotes,
  safeStorageFilename,
  selectAttachments,
  type AttachmentSelection,
} from '../_shared/email/content.ts'

import type { EmailProvider } from '../_shared/email/resend.ts'
import type { InboundAttachmentRef, InboundEmail } from '../_shared/email/normalize.ts'
import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'inquiry-attachments'

const DOWNLOAD_TIMEOUT_MS = 20_000

/** 기존 jsonb 형식과 같다(`admin/lib/data/inquiry-attachments.ts` 가 읽는 모양). */
export type StoredAttachment = { name: string; path: string; size: number; mimeType: string }

export type StoreResult = {
  stored: StoredAttachment[]
  /** 본문 끝에 붙일 안내가 반영된 내용. */
  content: string
}

async function resolveDownloadUrls(
  provider: EmailProvider | null,
  providerEmailId: string | null,
  accepted: readonly InboundAttachmentRef[],
): Promise<Map<string, string>> {
  const urls = new Map<string, string>()

  for (const attachment of accepted) {
    if (attachment.id !== null && attachment.downloadUrl !== null) {
      urls.set(attachment.id, attachment.downloadUrl)
    }
  }

  const missing = accepted.some((attachment) => attachment.id !== null && !urls.has(attachment.id))

  if (missing && provider !== null && providerEmailId !== null) {
    for (const listed of await provider.listReceivedAttachments(providerEmailId)) {
      if (listed.downloadUrl !== null) {
        urls.set(listed.id, listed.downloadUrl)
      }
    }
  }

  return urls
}

async function download(url: string): Promise<Uint8Array | null> {
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) })

  if (!response.ok) {
    return null
  }

  const bytes = new Uint8Array(await response.arrayBuffer())

  /* 목록의 size 가 없거나 틀릴 수 있어 실제 바이트로 다시 잰다. */
  return bytes.byteLength > MAX_ATTACHMENT_BYTES ? null : bytes
}

/**
 * @param room 문의에 더 넣을 수 있는 첨부 개수(`inquiries_attachments_max_3`). 회신 메일의
 *             첨부를 기존 문의에 합칠 때 3개를 넘지 않게 한다.
 */
export async function storeAttachments(
  service: SupabaseClient,
  provider: EmailProvider | null,
  email: InboundEmail,
  inquiryId: string,
  content: string,
  room: number,
  pathPrefix = '',
): Promise<StoreResult> {
  const selection: AttachmentSelection = selectAttachments(email.attachments)
  const fitting = selection.accepted.slice(0, Math.max(0, room))
  const extraOverflow = selection.accepted.length - fitting.length
  const stored: StoredAttachment[] = []
  const failed: string[] = []

  if (fitting.length > 0) {
    const urls = await resolveDownloadUrls(provider, email.providerEmailId, fitting)

    for (const [index, attachment] of fitting.entries()) {
      const url =
        attachment.id === null ? attachment.downloadUrl : (urls.get(attachment.id) ?? null)
      const bytes = url === null ? null : await download(url).catch(() => null)

      if (bytes === null) {
        failed.push(attachment.filename)

        continue
      }

      const path = `email/${inquiryId}/${pathPrefix}${safeStorageFilename(attachment.filename, index)}`
      const { error } = await service.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: attachment.contentType, upsert: false })

      if (error !== null) {
        console.error('[email-inbound] 첨부 업로드 실패', path, error.message)
        failed.push(attachment.filename)

        continue
      }

      stored.push({
        name: attachment.filename,
        path,
        size: bytes.byteLength,
        mimeType: attachment.contentType,
      })
    }
  }

  const notes: AttachmentSelection = {
    accepted: stored.map((entry) => ({
      id: null,
      filename: entry.name,
      contentType: entry.mimeType,
      size: entry.size,
      downloadUrl: null,
      contentDisposition: null,
    })),
    excluded: [
      ...selection.excluded,
      ...failed.map((filename) => ({ filename, reason: 'type' as const })),
    ],
    overflow: selection.overflow + extraOverflow,
  }

  return { stored, content: appendAttachmentNotes(content, notes) }
}
