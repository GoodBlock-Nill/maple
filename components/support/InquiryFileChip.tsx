import { CloseIcon } from '@/components/support/support-icons'
import { SUPPORT_CHIP_CLASS } from '@/components/support/support-styles'
import { truncateFileBase } from '@/lib/utils/file-name'
import { formatFileSize } from '@/lib/utils/format-file-size'

import type { ReactNode } from 'react'

type InquiryFileChipProps = {
  name: string
  /** 0 이면 크기를 그리지 않는다(알 수 없는 파일). */
  size?: number
  /** 이름 뒤에 붙는 상태 문구(업로드 진행률 · 첨부 완료 · 실패 사유). */
  status?: ReactNode
  /** 칩 오른쪽 X. 없으면 제거할 수 없는 칩이다. */
  onRemove?: () => void
  /** X 버튼이 읽히는 이름(무엇을 지우는지 이름까지 함께 읽는다). */
  removeLabel?: string
  /** X 왼쪽에 끼우는 추가 동작(예: 다시 시도). */
  children?: ReactNode
}

/**
 * 파일 칩(시안 v2) — 선택한 파일 · 기존 첨부 · 영상이 같은 모양을 쓴다.
 *
 * 이름은 **확장자를 남기고 앞부분만** 줄인다(`truncateFileBase`). 칩이 가로로
 * 늘어나면 한 줄에 세 개가 들어가지 않고, 확장자를 잃으면 "무슨 파일인지"를 알 수
 * 없다. 전체 이름은 `title` 로 남겨 마우스·스크린 리더가 그대로 읽는다.
 */
export function InquiryFileChip({
  name,
  size = 0,
  status,
  onRemove,
  removeLabel,
  children,
}: InquiryFileChipProps) {
  const formattedSize = formatFileSize(size)

  return (
    <span className={SUPPORT_CHIP_CLASS}>
      <span title={name} className="text-ink text-[15px] leading-[22px] whitespace-nowrap">
        {truncateFileBase(name)}
      </span>
      {formattedSize === '' ? null : (
        <span className="ml-2 shrink-0 text-[13px] leading-[18px] text-[#727272]">
          {formattedSize}
        </span>
      )}
      {status === undefined ? null : (
        <span className="ml-2 shrink-0 text-[13px] leading-[18px]">{status}</span>
      )}
      {children === undefined ? null : <span className="ml-2 shrink-0">{children}</span>}
      {onRemove === undefined ? null : (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${name} ${removeLabel ?? '제거'}`}
          className="text-ink hover:text-ink-muted focus-visible:outline-focus ml-3 shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <CloseIcon className="size-5" />
        </button>
      )}
    </span>
  )
}
