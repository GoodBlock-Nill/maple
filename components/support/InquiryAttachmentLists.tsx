import {
  INQUIRY_ATTACHMENT_REMOVE_FIELD,
  INQUIRY_ATTACHMENT_REMOVE_LABEL,
  INQUIRY_EXISTING_ATTACHMENT_HEADING,
} from '@/lib/constants/support'
import { formatFileSize } from '@/lib/utils/format-file-size'

import type { InquiryAttachment } from '@/types/domain'

/**
 * 첨부 입력이 그리는 두 목록 — 이미 올라가 있는 첨부와 지금 고른 파일.
 *
 * `InquiryAttachmentField` 에서 떼어 낸 표시 전용 조각이다. 검사·축소 로직과 섞여
 * 있으면 한 파일이 길어져 "무엇을 검사하는가"가 마크업에 묻힌다.
 */

const ROW_CLASS = 'text-ink flex items-center gap-2 text-[15px]'

type ExistingAttachmentListProps = {
  attachments: readonly InquiryAttachment[]
  /** 체크 상태를 폼 상태로 올린다 — 개수 제한을 셀 때 "뺄 것"까지 반영해야 한다. */
  onToggle: (path: string, isRemoved: boolean) => void
}

/**
 * 기존 첨부의 "삭제" 체크박스.
 *
 * 즉시 지우지 않는 이유는 저장을 누르지 않고 화면을 벗어난 사용자의 파일이 사라지면
 * 안 되기 때문이다 — 실제 삭제는 수정이 성공한 뒤 서버 액션이 한다. 체크박스 값은
 * 오브젝트 키(path)라, 서버는 이름이 같은 파일이 여러 개여도 정확히 하나만 지운다.
 */
export function ExistingAttachmentList({ attachments, onToggle }: ExistingAttachmentListProps) {
  if (attachments.length === 0) {
    return null
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-ink-muted text-[15px] font-medium">
        {INQUIRY_EXISTING_ATTACHMENT_HEADING}
      </legend>
      <ul className="flex flex-col gap-1.5 pt-1.5">
        {attachments.map((attachment) => (
          <li key={attachment.path}>
            <label className={ROW_CLASS}>
              <input
                type="checkbox"
                name={INQUIRY_ATTACHMENT_REMOVE_FIELD}
                value={attachment.path}
                onChange={(event) => onToggle(attachment.path, event.target.checked)}
                className="focus-visible:outline-focus size-5 shrink-0 appearance-none rounded-[4px] border-[1.5px] border-[#d5d9df] bg-white checked:border-[#2a2a2a] checked:bg-[#2a2a2a] focus-visible:outline-2 focus-visible:outline-offset-2"
              />
              <span className="min-w-0 truncate">{attachment.name}</span>
              <span className="text-ink-muted shrink-0">{formatFileSize(attachment.size)}</span>
              <span className="text-ink-muted shrink-0">{INQUIRY_ATTACHMENT_REMOVE_LABEL}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}

type SelectedFileListProps = {
  files: readonly File[]
  isPreparing: boolean
  onClear: () => void
}

/** 지금 고른 파일. 이름이 전혀 안 보이면 첨부됐는지 알 수 없다. */
export function SelectedFileList({ files, isPreparing, onClear }: SelectedFileListProps) {
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
    <div className="flex flex-col items-start gap-1.5">
      <ul aria-live="polite" className="flex flex-col gap-1">
        {files.map((file, index) => (
          <li key={`${file.name}-${index}`} className={ROW_CLASS}>
            <span className="min-w-0 truncate">{file.name}</span>
            <span className="text-ink-muted shrink-0">{formatFileSize(file.size)}</span>
          </li>
        ))}
      </ul>
      {/* 어긋난 선택에서 빠져나오는 유일한 길이다(잠긴 제출 버튼을 다시 여는 것도 이 버튼이다). */}
      <button
        type="button"
        onClick={onClear}
        className="tap-area text-ink-muted hover:text-ink text-[15px] underline underline-offset-4"
      >
        첨부 지우기
      </button>
    </div>
  )
}
