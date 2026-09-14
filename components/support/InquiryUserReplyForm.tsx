'use client'

import { useActionState, useCallback, useMemo, useState } from 'react'

import { FormFeedback } from '@/components/auth/FormFeedback'
import { InquiryAttachmentField } from '@/components/support/InquiryAttachmentField'
import { FormRow } from '@/components/support/InquiryFormRow'
import { InquirySubmitButton } from '@/components/support/InquirySubmitButton'
import { SUPPORT_FIELD_CLASS } from '@/components/support/support-styles'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { replyToInquiry } from '@/lib/actions/inquiry-reply-actions'
import {
  INQUIRY_USER_REPLY_FIELD_LABEL,
  INQUIRY_USER_REPLY_MAX,
  INQUIRY_USER_REPLY_PENDING_LABEL,
  INQUIRY_USER_REPLY_PLACEHOLDER,
  INQUIRY_USER_REPLY_SUBMIT_LABEL,
} from '@/lib/constants/inquiry-thread'
import { cn } from '@/lib/utils/cn'

const CONTENT_FIELD_ID = 'inquiry-reply-content'

type InquiryUserReplyFormProps = {
  /** 답장을 붙일 문의. 서버 액션에 bind 로 실린다(폼 필드로 두면 갈아 끼울 수 있다). */
  inquiryId: string
}

/**
 * 회원 답장 폼 — 스레드 아래에 선다.
 *
 * 접수 폼(`InquiryForm`)을 재사용하지 않는 이유는 규칙이 다르기 때문이다. 답장에는
 * 카테고리·계정 ID·동의가 없고, 상한도 RPC 를 따라 더 좁다. 대신 **첨부만은** 같은
 * 컴포넌트를 쓴다 — 이미지·PDF 3 + 영상 2, 같은 안내, 같은 칩이라 두 화면에서
 * 다르게 동작할 이유가 없다(영상도 같은 직접 업로드 경로를 탄다).
 *
 * 내용이 비었거나 첨부가 준비 중·규칙 위반이면 제출을 잠근다. 열어 두면 사용자가
 * 빈 답장을 보내거나(운영자는 무슨 말인지 모른 채 다시 묻는다) 첨부가 조용히 빠진
 * 답장이 나간다.
 */
export function InquiryUserReplyForm({ inquiryId }: InquiryUserReplyFormProps) {
  const action = useMemo(() => replyToInquiry.bind(null, inquiryId), [inquiryId])
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE)
  const [content, setContent] = useState('')
  const [isAttachmentBlocked, setIsAttachmentBlocked] = useState(false)
  const handleAttachmentBlockedChange = useCallback((value: boolean) => {
    setIsAttachmentBlocked(value)
  }, [])
  const fieldErrors = state.fieldErrors ?? {}

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormFeedback state={state} />

      <FormRow
        label={INQUIRY_USER_REPLY_FIELD_LABEL}
        htmlFor={CONTENT_FIELD_ID}
        error={fieldErrors.content}
        required
      >
        <textarea
          id={CONTENT_FIELD_ID}
          name="content"
          rows={5}
          required
          maxLength={INQUIRY_USER_REPLY_MAX}
          placeholder={INQUIRY_USER_REPLY_PLACEHOLDER}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className={cn(SUPPORT_FIELD_CLASS, 'rounded-panel h-[120px] resize-none px-4 py-2.5')}
        />
      </FormRow>

      <InquiryAttachmentField
        attachments={[]}
        error={fieldErrors.attachments}
        onBlockedChange={handleAttachmentBlockedChange}
      />

      <InquirySubmitButton
        disabled={content.trim() === '' || isAttachmentBlocked}
        describedBy={undefined}
        label={INQUIRY_USER_REPLY_SUBMIT_LABEL}
        pendingLabel={INQUIRY_USER_REPLY_PENDING_LABEL}
      />
    </form>
  )
}
