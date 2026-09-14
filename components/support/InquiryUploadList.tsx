'use client'

import { CHIP_LIST_CLASS } from '@/components/support/InquiryAttachmentLists'
import { InquiryFileChip } from '@/components/support/InquiryFileChip'

import type { InquiryUploadRow } from '@/components/support/use-inquiry-uploads'

/**
 * 올라가는 중이거나 올라간 첨부의 칩 — 이미지 · PDF · 영상이 같은 줄에 선다.
 *
 * 첨부는 제출 전에 이미 전송이 시작된다. 그래서 이 목록은 "고른 파일"이 아니라
 * **진행 중인 작업**을 그린다 — 진행률·취소·다시 시도가 칩에 함께 있어야 큰 파일을
 * 기다리는 동안 무엇을 할 수 있는지 안다. 실패도 **그 칩에만** 붙는다: 한 파일이
 * 거절돼도 나머지 첨부와 폼은 그대로 살아 있어야 한다.
 */

const ACTION_CLASS =
  'tap-area text-ink-muted hover:text-ink text-[13px] underline underline-offset-4'

const PERCENT = 100

/** 사유를 못 받은 행에도 할 말은 있어야 한다(무엇을 하면 되는지). */
const UPLOAD_FAILURE_TEXT = '파일을 올리지 못했습니다. 크기를 줄이거나 다른 파일을 선택해 주세요.'

type InquiryUploadListProps = {
  rows: readonly InquiryUploadRow[]
  onRemove: (id: string) => void
  onRetry: (id: string) => void
}

export function InquiryUploadList({ rows, onRemove, onRetry }: InquiryUploadListProps) {
  if (rows.length === 0) {
    return null
  }

  return (
    <ul aria-live="polite" className={CHIP_LIST_CLASS}>
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col gap-1">
          <InquiryFileChip
            name={row.name}
            size={row.size}
            status={<UploadStatus row={row} />}
            removeLabel={row.status === 'uploading' ? '업로드 취소' : '첨부 해제'}
            onRemove={() => onRemove(row.id)}
          >
            {row.status === 'error' ? (
              <button type="button" onClick={() => onRetry(row.id)} className={ACTION_CLASS}>
                다시 시도
              </button>
            ) : null}
          </InquiryFileChip>
          {row.status === 'uploading' ? <ProgressBar ratio={row.progress} /> : null}
          {/* 실패 사유는 칩 **밖에** 둔다 — 칩 안에 넣으면 문장 길이만큼 칩이 늘어나
              폰에서 X 와 "다시 시도"가 화면 밖으로 밀린다(그 칩을 내릴 길이 사라진다). */}
          {row.status === 'error' ? (
            <p className="max-w-[420px] text-[13px] leading-[18px] text-[#d33a3a]">
              {row.message ?? UPLOAD_FAILURE_TEXT}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

/** 칩 안에는 **한 단어**만 둔다. 긴 문장은 칩을 늘려 동작 버튼을 밀어낸다. */
function UploadStatus({ row }: { row: InquiryUploadRow }) {
  if (row.status === 'uploading') {
    return <span className="text-ink-muted">올리는 중 {Math.round(row.progress * PERCENT)}%</span>
  }

  if (row.status === 'done') {
    return <span className="text-ink-muted">첨부 완료</span>
  }

  return <span className="text-[#d33a3a]">실패</span>
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
      aria-label="첨부파일 업로드 진행률"
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
