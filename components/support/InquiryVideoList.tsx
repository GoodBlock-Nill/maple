'use client'

import { formatFileSize } from '@/lib/utils/format-file-size'

import type { InquiryVideoRow } from '@/components/support/use-inquiry-videos'

/**
 * 올라가는 중이거나 올라간 영상의 목록.
 *
 * 이미지와 달리 영상은 제출 전에 이미 전송이 시작된다. 그래서 이 목록은 "고른
 * 파일"이 아니라 **진행 중인 작업**을 그린다 — 진행률·취소·다시 시도가 한 줄에
 * 함께 있어야 사용자가 100MB 를 기다리는 동안 무엇을 할 수 있는지 안다.
 */

const ROW_CLASS = 'text-ink flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px]'

const ACTION_CLASS =
  'tap-area text-ink-muted hover:text-ink text-[15px] underline underline-offset-4'

const PERCENT = 100

type InquiryVideoListProps = {
  rows: readonly InquiryVideoRow[]
  onRemove: (id: string) => void
  onRetry: (id: string) => void
}

export function InquiryVideoList({ rows, onRemove, onRetry }: InquiryVideoListProps) {
  if (rows.length === 0) {
    return null
  }

  return (
    <ul aria-live="polite" className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col gap-1">
          <div className={ROW_CLASS}>
            <span className="min-w-0 truncate">{row.name}</span>
            <span className="text-ink-muted shrink-0">{formatFileSize(row.size)}</span>
            <VideoStatus row={row} />
            <VideoActions row={row} onRemove={onRemove} onRetry={onRetry} />
          </div>
          {row.status === 'uploading' ? <ProgressBar ratio={row.progress} /> : null}
        </li>
      ))}
    </ul>
  )
}

function VideoStatus({ row }: { row: InquiryVideoRow }) {
  if (row.status === 'uploading') {
    return (
      <span className="text-ink-muted shrink-0">
        올리는 중 {Math.round(row.progress * PERCENT)}%
      </span>
    )
  }

  if (row.status === 'done') {
    return <span className="text-ink-muted shrink-0">첨부 완료</span>
  }

  return (
    <span className="shrink-0 text-[#d33a3a]">{row.message ?? '영상을 올리지 못했습니다.'}</span>
  )
}

type VideoActionsProps = {
  row: InquiryVideoRow
  onRemove: (id: string) => void
  onRetry: (id: string) => void
}

function VideoActions({ row, onRemove, onRetry }: VideoActionsProps) {
  return (
    <span className="flex shrink-0 items-center gap-2">
      {row.status === 'error' ? (
        <button type="button" onClick={() => onRetry(row.id)} className={ACTION_CLASS}>
          다시 시도
        </button>
      ) : null}
      <button type="button" onClick={() => onRemove(row.id)} className={ACTION_CLASS}>
        {row.status === 'uploading' ? '업로드 취소' : '삭제'}
      </button>
    </span>
  )
}

/**
 * 진행률 막대.
 *
 * `<progress>` 대신 div 두 개를 쓰는 이유는 브라우저마다 기본 스타일이 달라
 * 시안의 두께·색을 맞출 수 없기 때문이다. 접근성은 role 로 채운다.
 */
function ProgressBar({ ratio }: { ratio: number }) {
  const percent = Math.round(Math.min(Math.max(ratio, 0), 1) * PERCENT)

  return (
    <div
      role="progressbar"
      aria-label="영상 업로드 진행률"
      aria-valuemin={0}
      aria-valuemax={PERCENT}
      aria-valuenow={percent}
      className="bg-line h-1.5 w-full max-w-[320px] overflow-hidden rounded-full"
    >
      <div
        className="h-full rounded-full bg-[#2a2a2a] transition-[width] duration-200"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
