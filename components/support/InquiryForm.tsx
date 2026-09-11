'use client'

import Link from 'next/link'
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { FormFeedback } from '@/components/auth/FormFeedback'
import { InquiryAttachmentField } from '@/components/support/InquiryAttachmentField'
import { InquiryConsentField } from '@/components/support/InquiryConsentField'
import { InquiryFields } from '@/components/support/InquiryFields'
import { InquirySubmitButton } from '@/components/support/InquirySubmitButton'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { createInquiry } from '@/lib/actions/inquiry-actions'
import { updateInquiry } from '@/lib/actions/inquiry-edit-actions'
import {
  INQUIRY_EDIT_SUBMIT_LABEL,
  INQUIRY_REQUIRED_NOTICE,
  LOGIN_REQUIRED_INQUIRY_NOTICE,
  MY_INQUIRIES_HEADING,
  MY_INQUIRIES_PATH,
} from '@/lib/constants/support'
import { isInquiryFormFilled } from '@/lib/validation/inquiry'

import type { InquiryFormValues } from '@/components/support/InquiryFields'
import type { InquiryAttachment, InquiryCategoryOption } from '@/types/domain'

const SUBMIT_NOTICE_ID = 'inquiry-submit-notice'
const REQUIRED_NOTICE_ID = 'inquiry-required-notice'
const LOGIN_HREF = `/login?next=${encodeURIComponent('/support')}`

type InquiryFormProps = {
  /** 서버에서 판정한 로그인 여부. 폼 잠금과 "내 문의 내역" 링크 노출에 쓴다. */
  isAuthenticated: boolean
  /** 서버가 DB 에서 읽어 넘긴 카테고리(라벨 · 안내 · 프리필 양식). */
  categories: readonly InquiryCategoryOption[]
  /** 넘기면 수정 모드가 된다. 없으면 새 문의 접수. */
  inquiryId?: string
  defaultValues?: InquiryFormValues
  /** 수정 모드에서 이미 올라가 있는 첨부. */
  attachments?: readonly InquiryAttachment[]
  /** 접수 모드에서 계정 ID 칸에 미리 채울 값(프로필의 월드 UID). */
  defaultAccountId?: string
}

/** 잠긴 제출 버튼이 가리킬 안내. 로그인 쪽이 먼저다(그 상태에서는 입력도 못 한다). */
function requiredDescribedBy(isAuthenticated: boolean, isIncomplete: boolean): string | undefined {
  if (!isAuthenticated) {
    return SUBMIT_NOTICE_ID
  }

  return isIncomplete ? REQUIRED_NOTICE_ID : undefined
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
  categories,
  inquiryId,
  defaultValues,
  attachments = [],
  defaultAccountId,
}: InquiryFormProps) {
  const isEditMode = inquiryId !== undefined
  const action = useMemo(
    () => (inquiryId === undefined ? createInquiry : updateInquiry.bind(null, inquiryId)),
    [inquiryId],
  )
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE)
  /* 첨부가 준비 중이거나 규칙에 어긋나 있으면 제출을 잠근다. 열어 두면 (1) 축소 전
     원본이 실려 나가 본문 상한을 넘기거나 (2) 첨부가 조용히 빠진 문의가 접수된다. */
  const [isAttachmentBlocked, setIsAttachmentBlocked] = useState(false)
  const handleAttachmentBlockedChange = useCallback((value: boolean) => {
    setIsAttachmentBlocked(value)
  }, [])
  const fieldErrors = state.fieldErrors ?? {}
  /* 필수 항목이 덜 채워졌으면 제출을 잠근다(2026-09-11 제품 결정 — 첨부만 선택).
     값마다 상태를 두는 대신 폼 DOM 을 그대로 읽는다: 입력이 늘어나도 판정이 한
     자리에 남고, 수정 화면처럼 서버가 채워 준 값도 마운트 직후 그대로 잡힌다. */
  const formRef = useRef<HTMLFormElement>(null)
  const [isIncomplete, setIsIncomplete] = useState(true)
  const syncRequired = useCallback(() => {
    const form = formRef.current

    if (form !== null) {
      setIsIncomplete(!isInquiryFormFilled(new FormData(form), !isEditMode))
    }
  }, [isEditMode])

  useEffect(syncRequired, [syncRequired])

  return (
    /* 세로 리듬은 시안 v2 기준 행 간격 20(라벨 25.5 + 10 + 필드 40). */
    <form
      ref={formRef}
      action={formAction}
      /* 리액트의 onChange 는 입력마다 올라오므로(제어·비제어 모두) 폼 하나에
         걸어 두면 모든 칸의 변화를 한 번에 받는다. */
      onChange={syncRequired}
      className="flex flex-col gap-5"
    >
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

      <InquiryFields
        categories={categories}
        values={defaultValues}
        defaultAccountId={defaultAccountId}
        fieldErrors={fieldErrors}
      />

      <InquiryAttachmentField
        attachments={attachments}
        error={fieldErrors.attachments}
        onBlockedChange={handleAttachmentBlockedChange}
      />

      {/* 동의는 접수 시점에 이미 받아 저장돼 있다. 수정 화면에서 다시 묻지 않는다. */}
      {isEditMode ? null : <InquiryConsentField error={fieldErrors.consent} />}

      <div className="flex flex-col items-start gap-2">
        <InquirySubmitButton
          disabled={!isAuthenticated || isAttachmentBlocked || isIncomplete}
          describedBy={requiredDescribedBy(isAuthenticated, isIncomplete)}
          label={isEditMode ? INQUIRY_EDIT_SUBMIT_LABEL : undefined}
          pendingLabel={isEditMode ? '저장 중…' : undefined}
        />
        {isAuthenticated ? null : (
          <p id={SUBMIT_NOTICE_ID} className="text-ink-muted text-[15px]">
            <Link href={LOGIN_HREF} className="tap-area underline underline-offset-4">
              {LOGIN_REQUIRED_INQUIRY_NOTICE}
            </Link>
          </p>
        )}

        {/* 잠긴 버튼 옆에 이유를 남긴다 — 로그인 안내와 같은 자리, 같은 문투다. */}
        {isAuthenticated && isIncomplete ? (
          <p id={REQUIRED_NOTICE_ID} className="text-ink-muted text-[15px]">
            {INQUIRY_REQUIRED_NOTICE}
          </p>
        ) : null}
      </div>
    </form>
  )
}
