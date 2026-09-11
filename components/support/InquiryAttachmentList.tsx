import { INQUIRY_ATTACHMENT_HEADING } from '@/lib/constants/support'
import { formatFileSize } from '@/lib/utils/format-file-size'
import { isVideoAttachment } from '@/lib/validation/inquiry-video'

import type { SignedInquiryAttachment } from '@/types/domain'

type InquiryAttachmentListProps = {
  attachments: readonly SignedInquiryAttachment[]
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

/**
 * 서명 URL 에 내려받기 처리를 붙인다.
 *
 * `<a download>` 은 **동일 출처에서만** 동작한다 — 서명 URL 은 Supabase 도메인이라
 * 그대로 두면 파일 이름을 잃고 브라우저가 그냥 열어 버린다. Storage 가 이해하는
 * `download` 질의 파라미터로 Content-Disposition 을 붙여 원래 이름으로 받게 한다.
 */
function downloadHref(url: string, name: string): string {
  return `${url}&download=${encodeURIComponent(name)}`
}

/**
 * 문의 첨부 목록.
 *
 * `inquiry-attachments` 는 비공개 버킷이라 링크는 수 분짜리 서명 URL 이다.
 * 그래서 `next/image` 를 쓰지 않는다 — 이미지 최적화기는 만료되는 URL 을 캐시하고,
 * 통과시키려면 스토리지 호스트를 `remotePatterns` 에 열어야 한다(= 임의 오브젝트
 * 프록시 경로가 생긴다). 서명 발급에 실패한 항목은 링크 없이 이름만 남긴다.
 *
 * 영상은 링크가 아니라 **그 자리에서 재생**한다. 새 탭으로 열면 서명 URL 이
 * 주소창과 방문 기록에 남고, 만료된 뒤에는 되돌아올 수도 없다.
 */
export function InquiryAttachmentList({ attachments }: InquiryAttachmentListProps) {
  if (attachments.length === 0) {
    return null
  }

  return (
    /* 본문 상자 아래에 같은 리듬(gap 12)으로 붙는다 — 시안에는 없는 블록이라
       본문과 톤을 맞추고 제목은 한 단계 작게 둔다. */
    <section className="mt-3 flex flex-col gap-2.5">
      <h3 className="text-ink text-[14px] leading-[20px] font-semibold lg:text-[16px] lg:leading-[22px]">
        {INQUIRY_ATTACHMENT_HEADING}
      </h3>
      <ul className="flex flex-wrap items-start gap-3">
        {attachments.map((attachment) => (
          <li
            key={attachment.path}
            className={isVideoAttachment(attachment.mimeType) ? 'w-full' : undefined}
          >
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

  if (isVideoAttachment(attachment.mimeType)) {
    return <VideoAttachment attachment={attachment} url={attachment.url} label={label} />
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

type VideoAttachmentProps = {
  attachment: SignedInquiryAttachment
  /** `attachment.url` 을 좁힌 값. 여기까지 왔다면 null 이 아니다. */
  url: string
  label: string
}

/**
 * 영상 첨부.
 *
 * `preload="metadata"` 로 두는 이유는 상세를 열자마자 100MB 를 내려받지 않기
 * 위해서다 — 길이·첫 프레임만 받고, 실제 데이터는 재생을 누를 때 받는다.
 */
function VideoAttachment({ attachment, url, label }: VideoAttachmentProps) {
  return (
    <figure className="border-line-soft bg-page-sub flex max-w-[520px] flex-col gap-2 rounded-[10px] border p-3">
      {/* 사용자가 올린 영상이라 자막 트랙이 없다. */}
      <video
        controls
        preload="metadata"
        src={url}
        aria-label={attachment.name}
        className="w-full rounded-[6px] bg-black"
      />
      <figcaption className="text-ink-muted flex flex-wrap items-center gap-2 text-[14px]">
        <span className="min-w-0 truncate">{label}</span>
        <a
          href={downloadHref(url, attachment.name)}
          className="tap-area text-ink underline underline-offset-4"
        >
          내려받기
        </a>
      </figcaption>
    </figure>
  )
}
