import { INQUIRY_ATTACHMENT_HEADING } from '@/lib/constants/support'

import type { SignedInquiryAttachment } from '@/types/domain'

type InquiryAttachmentListProps = {
  attachments: readonly SignedInquiryAttachment[]
}

const KILOBYTE = 1024
const MEGABYTE = KILOBYTE * KILOBYTE

/** 사람이 읽는 파일 크기. 소수점은 MB 에서만 의미가 있어 KB 는 정수로 끊는다. */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) {
    return ''
  }

  if (bytes < MEGABYTE) {
    return `${Math.max(1, Math.round(bytes / KILOBYTE))}KB`
  }

  return `${(bytes / MEGABYTE).toFixed(1)}MB`
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

/**
 * 문의 첨부 목록.
 *
 * `inquiry-attachments` 는 비공개 버킷이라 링크는 수 분짜리 서명 URL 이다.
 * 그래서 `next/image` 를 쓰지 않는다 — 이미지 최적화기는 만료되는 URL 을 캐시하고,
 * 통과시키려면 스토리지 호스트를 `remotePatterns` 에 열어야 한다(= 임의 오브젝트
 * 프록시 경로가 생긴다). 서명 발급에 실패한 항목은 링크 없이 이름만 남긴다.
 */
export function InquiryAttachmentList({ attachments }: InquiryAttachmentListProps) {
  if (attachments.length === 0) {
    return null
  }

  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-ink text-[17px] font-bold">{INQUIRY_ATTACHMENT_HEADING}</h3>
      <ul className="flex flex-wrap gap-3">
        {attachments.map((attachment) => (
          <li key={attachment.path}>
            <AttachmentItem attachment={attachment} />
          </li>
        ))}
      </ul>
    </section>
  )
}

type AttachmentItemProps = {
  attachment: SignedInquiryAttachment
}

const ITEM_CLASS =
  'border-line-soft text-ink flex items-center gap-2 rounded-[10px] border bg-page-sub px-3 py-2 ' +
  'text-[15px] transition-colors hover:border-ink/40 focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-focus'

function AttachmentItem({ attachment }: AttachmentItemProps) {
  const size = formatFileSize(attachment.size)
  const label = size === '' ? attachment.name : `${attachment.name} (${size})`

  if (attachment.url === null) {
    return <span className={`${ITEM_CLASS} text-ink-muted`}>{label}</span>
  }

  return (
    <a href={attachment.url} target="_blank" rel="noreferrer" className={ITEM_CLASS}>
      {isImage(attachment.mimeType) ? (
        // eslint-disable-next-line @next/next/no-img-element -- 만료되는 서명 URL 이라 이미지 최적화기를 태우지 않는다.
        <img
          src={attachment.url}
          alt=""
          width={48}
          height={48}
          className="border-line-soft size-12 shrink-0 rounded-[6px] border object-cover"
        />
      ) : null}
      <span className="max-w-[220px] truncate underline underline-offset-4">{label}</span>
    </a>
  )
}
