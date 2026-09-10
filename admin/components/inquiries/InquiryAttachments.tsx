'use client'

import { useState } from 'react'

import { Dialog } from '@/components/ui'

import type { InquiryAttachment } from '@/lib/data/inquiries'

const KILOBYTE = 1024

function formatSize(bytes: number): string {
  if (bytes <= 0) {
    return ''
  }

  if (bytes < KILOBYTE * KILOBYTE) {
    return `${Math.max(1, Math.round(bytes / KILOBYTE))}KB`
  }

  return `${(bytes / (KILOBYTE * KILOBYTE)).toFixed(1)}MB`
}

/** 버킷이 허용하는 형식은 이미지 · pdf · zip · txt · 영상 4종이다(20260910000600). */
function isImage(attachment: InquiryAttachment): boolean {
  return attachment.mimeType.startsWith('image/')
}

/** 영상은 목록에서 바로 재생한다 — 새 탭으로 열면 서명 URL 이 주소창에 남는다. */
function isVideo(attachment: InquiryAttachment): boolean {
  return attachment.mimeType.startsWith('video/')
}

/**
 * 이미지가 아닌 첨부(PDF 등)의 내려받기 주소.
 *
 * `<a download>` 은 **동일 출처에서만** 동작한다 — 서명 URL 은 Supabase 도메인이라
 * 그대로 두면 파일 이름을 잃고 브라우저가 그냥 열어 버린다. Storage 가 이해하는
 * `download` 질의 파라미터로 Content-Disposition 을 붙여 원래 이름으로 받게 한다.
 */
function downloadHref(attachment: InquiryAttachment): string {
  return `${attachment.url}&download=${encodeURIComponent(attachment.name)}`
}

/**
 * 문의 첨부.
 *
 * `inquiry-attachments` 는 비공개 버킷이라 서버에서 발급한 서명 URL 로만 열린다.
 * 서명은 5분이면 만료되므로 이미지도 `next/image` 로 최적화하지 않는다 —
 * 최적화 캐시가 만료된 URL 을 붙들면 깨진 이미지가 남는다.
 *
 * 이미지는 썸네일을 눌러 원본 크기로 본다. 새 탭으로 열면 서명 URL 이 주소창에
 * 노출되고 히스토리에 남는다.
 */
export function InquiryAttachments({ attachments }: { attachments: readonly InquiryAttachment[] }) {
  const [preview, setPreview] = useState<InquiryAttachment | null>(null)

  if (attachments.length === 0) {
    return <p className="text-muted text-[13px]">첨부파일이 없습니다.</p>
  }

  return (
    <>
      <ul className="flex flex-wrap items-start gap-3">
        {attachments.map((attachment) => (
          <li key={attachment.path} className={isVideo(attachment) ? 'w-full' : undefined}>
            {attachment.url === null ? (
              <span className="text-muted border-line rounded-panel border border-dashed px-3 py-2 text-[13px]">
                {attachment.name} (링크 발급 실패)
              </span>
            ) : isVideo(attachment) ? (
              <VideoAttachment attachment={attachment} />
            ) : isImage(attachment) ? (
              <button
                type="button"
                onClick={() => setPreview(attachment)}
                className="border-line rounded-panel hover:border-accent focus-visible:outline-focus block overflow-hidden border focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- 서명 URL 은 next/image 의 원격 패턴(public 경로) 밖이고 5분 뒤 만료된다. */}
                <img
                  src={attachment.url}
                  alt={attachment.name}
                  className="h-24 w-24 object-cover"
                  loading="lazy"
                />
              </button>
            ) : (
              <a
                href={downloadHref(attachment)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-strong border-line rounded-panel hover:bg-page focus-visible:outline-focus inline-flex items-center gap-2 border px-3 py-2 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {attachment.name}
                <span className="text-muted font-normal">{formatSize(attachment.size)}</span>
              </a>
            )}
          </li>
        ))}
      </ul>

      <Dialog
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={preview?.name ?? '첨부 이미지'}
      >
        {preview?.url !== null && preview !== null && (
          /* eslint-disable-next-line @next/next/no-img-element -- 위와 같은 이유(서명 URL). */
          <img
            src={preview.url}
            alt={preview.name}
            className="max-h-[70vh] w-full object-contain"
          />
        )}
      </Dialog>
    </>
  )
}

/**
 * 영상 첨부.
 *
 * `preload="metadata"` 라 상세를 여는 것만으로 100MB 를 내려받지 않는다. 운영자가
 * 재생을 눌러야 실제 데이터가 흐른다. 원본이 필요하면 내려받기 링크를 쓴다.
 */
function VideoAttachment({ attachment }: { attachment: InquiryAttachment }) {
  return (
    <figure className="border-line rounded-panel flex max-w-[520px] flex-col gap-2 border p-3">
      {/* 사용자가 올린 영상이라 자막 트랙이 없다. */}
      <video
        controls
        preload="metadata"
        src={attachment.url ?? undefined}
        aria-label={attachment.name}
        className="w-full rounded-[6px] bg-black"
      />
      <figcaption className="text-muted flex flex-wrap items-center gap-2 text-[13px]">
        <span className="min-w-0 truncate">{attachment.name}</span>
        <span>{formatSize(attachment.size)}</span>
        <a
          href={downloadHref(attachment)}
          className="text-accent-strong font-semibold underline underline-offset-4"
        >
          내려받기
        </a>
      </figcaption>
    </figure>
  )
}
