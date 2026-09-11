import { InquiryFileChip } from '@/components/support/InquiryFileChip'
import {
  INQUIRY_ATTACHMENT_REMOVE_FIELD,
  INQUIRY_ATTACHMENT_REMOVE_LABEL,
  INQUIRY_EXISTING_ATTACHMENT_HEADING,
} from '@/lib/constants/support'

import type { InquiryAttachment } from '@/types/domain'

/**
 * 첨부 입력이 그리는 두 목록 — 이미 올라가 있는 첨부와 지금 고른 파일.
 *
 * `InquiryAttachmentField` 에서 떼어 낸 표시 전용 조각이다. 검사·축소 로직과 섞여
 * 있으면 한 파일이 길어져 "무엇을 검사하는가"가 마크업에 묻힌다.
 */

/** 칩 줄(시안 v2): 폰은 세로 gap 8, PC 는 wrap gap 12. */
export const CHIP_LIST_CLASS = 'flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:gap-3'

type ExistingAttachmentListProps = {
  attachments: readonly InquiryAttachment[]
  /** 저장 시 뺄 첨부의 오브젝트 키. 칩에서 사라지고 숨은 입력으로 전송된다. */
  removedPaths: readonly string[]
  onRemove: (path: string) => void
}

/**
 * 기존 첨부 칩.
 *
 * X 를 눌러도 **즉시 지우지 않는다** — 저장을 누르지 않고 화면을 벗어난 사용자의
 * 파일이 사라지면 안 되기 때문이다. 실제 삭제는 수정이 성공한 뒤 서버 액션이 한다.
 * 전송값은 예전 "삭제" 체크박스와 같은 오브젝트 키(path)라, 서버는 이름이 같은
 * 파일이 여러 개여도 정확히 하나만 지운다.
 */
export function ExistingAttachmentList({
  attachments,
  removedPaths,
  onRemove,
}: ExistingAttachmentListProps) {
  if (attachments.length === 0) {
    return null
  }

  const kept = attachments.filter((attachment) => !removedPaths.includes(attachment.path))

  return (
    <fieldset>
      {/* 칩만으로는 "이미 올라가 있던 파일"과 "방금 고른 파일"을 소리로 구분할 수 없다. */}
      <legend className="sr-only">{INQUIRY_EXISTING_ATTACHMENT_HEADING}</legend>
      <ul className={CHIP_LIST_CLASS}>
        {kept.map((attachment) => (
          <li key={attachment.path}>
            <InquiryFileChip
              name={attachment.name}
              size={attachment.size}
              removeLabel={INQUIRY_ATTACHMENT_REMOVE_LABEL}
              onRemove={() => onRemove(attachment.path)}
            />
          </li>
        ))}
      </ul>
      {removedPaths.map((path) => (
        <input key={path} type="hidden" name={INQUIRY_ATTACHMENT_REMOVE_FIELD} value={path} />
      ))}
    </fieldset>
  )
}

type SelectedFileListProps = {
  files: readonly File[]
  isPreparing: boolean
  onRemove: (index: number) => void
}

/** 지금 고른 파일. 이름이 전혀 안 보이면 첨부됐는지 알 수 없다. */
export function SelectedFileList({ files, isPreparing, onRemove }: SelectedFileListProps) {
  if (isPreparing) {
    return (
      <p aria-live="polite" className="text-ink-muted text-[15px]">
        첨부파일을 준비하는 중입니다…
      </p>
    )
  }

  if (files.length === 0) {
    return null
  }

  return (
    /* 칩의 X 가 어긋난 선택에서 빠져나오는 길이다(잠긴 제출 버튼을 다시 여는 것도 이것이다). */
    <ul aria-live="polite" className={CHIP_LIST_CLASS}>
      {files.map((file, index) => (
        <li key={`${file.name}-${index}`}>
          <InquiryFileChip
            name={file.name}
            size={file.size}
            removeLabel="첨부 해제"
            onRemove={() => onRemove(index)}
          />
        </li>
      ))}
    </ul>
  )
}
