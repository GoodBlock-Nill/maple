'use client'

import Link from 'next/link'
import { useActionState, useMemo } from 'react'

import { FormFeedback } from '@/components/auth/FormFeedback'
import { InquiryAttachmentField } from '@/components/support/InquiryAttachmentField'
import { InquiryFields } from '@/components/support/InquiryFields'
import { FieldError } from '@/components/support/InquiryFormRow'
import { InquirySubmitButton } from '@/components/support/InquirySubmitButton'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { createInquiry } from '@/lib/actions/inquiry-actions'
import { updateInquiry } from '@/lib/actions/inquiry-edit-actions'
import {
  INQUIRY_EDIT_SUBMIT_LABEL,
  LOGIN_REQUIRED_INQUIRY_NOTICE,
  MY_INQUIRIES_HEADING,
  MY_INQUIRIES_PATH,
  PRIVACY_CONSENT_LABEL,
  PRIVACY_CONSENT_LINK_LABEL,
  PRIVACY_POLICY_PATH,
} from '@/lib/constants/support'

import type { InquiryFormValues } from '@/components/support/InquiryFields'
import type { InquiryAttachment } from '@/types/domain'

const SUBMIT_NOTICE_ID = 'inquiry-submit-notice'
const LOGIN_HREF = `/login?next=${encodeURIComponent('/support')}`

type InquiryFormProps = {
  /** 서버에서 판정한 로그인 여부. 폼 잠금과 "내 문의 내역" 링크 노출에 쓴다. */
  isAuthenticated: boolean
  /** 넘기면 수정 모드가 된다. 없으면 새 문의 접수. */
  inquiryId?: string
  defaultValues?: InquiryFormValues
  /** 수정 모드에서 이미 올라가 있는 첨부. */
  attachments?: readonly InquiryAttachment[]
}

/**
 * 1:1 문의 접수 · 수정 폼.
 *
 * 접수와 수정은 같은 규칙(`updateInquirySchema` = `createInquirySchema` − 동의)을
 * 쓰므로 폼을 나누지 않는다. 나누면 상한이 갈려서 "접수는 됐는데 수정은 막히는"
 * 문의가 생긴다. 대상 문의 id 는 서버 액션에 bind 로 실어 폼 필드에서 조작할 수 없게 한다.
 *
 * 성공하면 두 액션 모두 상세로 리다이렉트하므로, 이 컴포넌트는 실패 상태
 * (필드 오류·안내)만 그린다.
 */
export function InquiryForm({
  isAuthenticated,
  inquiryId,
  defaultValues,
  attachments = [],
}: InquiryFormProps) {
  const isEditMode = inquiryId !== undefined
  const action = useMemo(
    () => (inquiryId === undefined ? createInquiry : updateInquiry.bind(null, inquiryId)),
    [inquiryId],
  )
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE)
  const fieldErrors = state.fieldErrors ?? {}

  return (
    /* 세로 리듬은 시안 렌더(support.png) 기준 행 간격 17(라벨 25.5 + 8 + 필드 40). */
    <form action={formAction} className="flex flex-col gap-5 lg:gap-[17px]">
      {isAuthenticated && !isEditMode ? (
        <div className="flex justify-end">
          <Link
            href={MY_INQUIRIES_PATH}
            className="text-ink-muted hover:text-ink text-[15px] font-medium underline underline-offset-4 transition-colors"
          >
            {MY_INQUIRIES_HEADING} 보기
          </Link>
        </div>
      ) : null}

      <FormFeedback state={state} />

      <InquiryFields values={defaultValues} fieldErrors={fieldErrors} />

      <InquiryAttachmentField attachments={attachments} error={fieldErrors.attachments} />

      {/* 동의는 접수 시점에 이미 받아 저장돼 있다. 수정 화면에서 다시 묻지 않는다. */}
      {isEditMode ? null : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              id="inquiry-consent"
              name="consent"
              type="checkbox"
              className="focus-visible:outline-focus size-[30px] shrink-0 appearance-none rounded-[5px] border-[1.5px] border-[#d5d9df] bg-white checked:border-[#2a2a2a] checked:bg-[#2a2a2a] focus-visible:outline-2 focus-visible:outline-offset-2"
            />
            <label htmlFor="inquiry-consent" className="text-ui text-[#1e2938]">
              {PRIVACY_CONSENT_LABEL}
            </label>
            <Link
              href={PRIVACY_POLICY_PATH}
              className="tap-area text-ui text-[#0067ff] underline underline-offset-2"
            >
              {PRIVACY_CONSENT_LINK_LABEL}
            </Link>
          </div>
          <FieldError message={fieldErrors.consent} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <InquirySubmitButton
          disabled={!isAuthenticated}
          describedBy={isAuthenticated ? undefined : SUBMIT_NOTICE_ID}
          label={isEditMode ? INQUIRY_EDIT_SUBMIT_LABEL : undefined}
          pendingLabel={isEditMode ? '저장 중…' : undefined}
        />
        {isAuthenticated ? null : (
          <p id={SUBMIT_NOTICE_ID} className="text-ink-muted text-center text-[15px]">
            <Link href={LOGIN_HREF} className="tap-area underline underline-offset-4">
              {LOGIN_REQUIRED_INQUIRY_NOTICE}
            </Link>
          </p>
        )}
      </div>
    </form>
  )
}
