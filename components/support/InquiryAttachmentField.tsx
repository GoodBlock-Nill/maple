import { FieldError } from '@/components/support/InquiryFormRow'
import { SUPPORT_LABEL_CLASS } from '@/components/support/support-styles'
import {
  ATTACHMENT_NOTICE,
  INQUIRY_ATTACHMENT_REMOVE_FIELD,
  INQUIRY_ATTACHMENT_REMOVE_LABEL,
  INQUIRY_EXISTING_ATTACHMENT_HEADING,
} from '@/lib/constants/support'
import { formatFileSize } from '@/lib/utils/format-file-size'

import type { InquiryAttachment } from '@/types/domain'

type InquiryAttachmentFieldProps = {
  /** 수정 모드에서 이미 올라가 있는 첨부. 접수 모드에서는 빈 배열. */
  attachments: readonly InquiryAttachment[]
  error: string | undefined
}

/**
 * 첨부 입력.
 *
 * 기존 첨부는 "삭제" 체크박스로 뺀다. 즉시 지우지 않는 이유는 저장을 누르지 않고
 * 화면을 벗어난 사용자의 파일이 사라지면 안 되기 때문이다 — 실제 삭제는 수정이
 * 성공한 뒤 서버 액션이 한다. 체크박스 값은 오브젝트 키(path)라, 서버는 이름이
 * 같은 파일이 여러 개여도 정확히 하나만 지운다.
 */
export function InquiryAttachmentField({ attachments, error }: InquiryAttachmentFieldProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="flex flex-wrap items-center gap-2">
        <span className={`${SUPPORT_LABEL_CLASS} font-bold`}>첨부파일</span>
        <span className="text-ink-muted text-ui">{ATTACHMENT_NOTICE}</span>
      </p>

      {attachments.length === 0 ? null : (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-ink-muted text-[15px] font-medium">
            {INQUIRY_EXISTING_ATTACHMENT_HEADING}
          </legend>
          <ul className="flex flex-col gap-1.5 pt-1.5">
            {attachments.map((attachment) => (
              <li key={attachment.path}>
                <label className="text-ink flex items-center gap-2 text-[15px]">
                  <input
                    type="checkbox"
                    name={INQUIRY_ATTACHMENT_REMOVE_FIELD}
                    value={attachment.path}
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
      )}

      {/* 시안: 라벨 폭에 맞는 작은 버튼. 블록 <label> 이라 전폭으로 늘어나던 것을 막는다. */}
      <label className="w-fit rounded-[5px] border border-[#d5d9df] bg-[#e7e7e7] px-4 text-ui focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-focus)]">
        <span className="text-ink flex h-10 items-center">파일 선택</span>
        <input
          type="file"
          name="attachments"
          multiple
          accept=".jpg,.jpeg,.png,.gif,.pdf"
          className="sr-only"
        />
      </label>

      <FieldError message={error} />
    </div>
  )
}
