'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { FormFeedback } from '@/components/auth/FormFeedback'
import { FieldError, FormRow } from '@/components/support/InquiryFormRow'
import { InquirySubmitButton } from '@/components/support/InquirySubmitButton'
import {
  SUPPORT_FIELD_CLASS,
  SUPPORT_INPUT_CLASS,
  SUPPORT_LABEL_CLASS,
} from '@/components/support/support-styles'
import { createInquiry } from '@/lib/actions/inquiry-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import {
  ATTACHMENT_NOTICE,
  INQUIRY_CATEGORIES,
  INQUIRY_TYPES,
  LOGIN_REQUIRED_INQUIRY_NOTICE,
  MY_INQUIRIES_HEADING,
  MY_INQUIRIES_PATH,
  PRIVACY_CONSENT_LABEL,
  PRIVACY_CONSENT_LINK_LABEL,
  PRIVACY_POLICY_PATH,
} from '@/lib/constants/support'
import { cn } from '@/lib/utils/cn'

const SELECT_CLASS = cn(SUPPORT_FIELD_CLASS, 'support-select rounded-panel h-10 pr-10 pl-[14px]')
const SUBMIT_NOTICE_ID = 'inquiry-submit-notice'
const LOGIN_HREF = `/login?next=${encodeURIComponent('/support')}`

type InquiryFormProps = {
  /** 서버에서 판정한 로그인 여부. 폼 잠금과 "내 문의 내역" 링크 노출에 쓴다. */
  isAuthenticated: boolean
}

/**
 * 1:1 문의 폼.
 *
 * 접수에 성공하면 서버 액션이 상세(`/support/inquiries/[id]?submitted=1`)로
 * 리다이렉트하므로, 이 컴포넌트는 실패 상태(필드 오류·안내)만 그린다.
 */
export function InquiryForm({ isAuthenticated }: InquiryFormProps) {
  const [state, formAction] = useActionState(createInquiry, EMPTY_FORM_STATE)
  const fieldErrors = state.fieldErrors ?? {}

  return (
    /* 세로 리듬은 시안 렌더(support.png) 기준 행 간격 17(라벨 25.5 + 8 + 필드 40). */
    <form action={formAction} className="flex flex-col gap-5 lg:gap-[17px]">
      {isAuthenticated ? (
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

      <FormRow label="글자월드 계정 ID" htmlFor="inquiry-account" error={fieldErrors.accountId}>
        <input
          id="inquiry-account"
          name="accountId"
          type="text"
          inputMode="numeric"
          placeholder="예: 123456789000000"
          className={cn(SUPPORT_INPUT_CLASS, 'rounded-pill')}
        />
      </FormRow>

      <FormRow
        label="카테고리 및 유형 선택"
        htmlFor="inquiry-category"
        error={fieldErrors.category ?? fieldErrors.type}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select id="inquiry-category" name="category" defaultValue="" className={SELECT_CLASS}>
            <option value="" disabled>
              카테고리를 선택해주세요
            </option>
            {INQUIRY_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select name="type" defaultValue="" aria-label="유형 선택" className={SELECT_CLASS}>
            <option value="" disabled>
              유형을 선택해주세요
            </option>
            {INQUIRY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </FormRow>

      <FormRow label="제목" htmlFor="inquiry-title" error={fieldErrors.title}>
        <input
          id="inquiry-title"
          name="title"
          type="text"
          placeholder="제목을 입력해 주세요."
          className={SUPPORT_INPUT_CLASS}
        />
      </FormRow>

      <FormRow label="문의 내용" htmlFor="inquiry-body" error={fieldErrors.content}>
        <textarea
          id="inquiry-body"
          name="content"
          rows={6}
          placeholder="내용을 입력해 주세요."
          className={cn(SUPPORT_FIELD_CLASS, 'rounded-panel h-[150px] resize-none p-4')}
        />
      </FormRow>

      <div className="flex flex-col gap-2.5">
        <p className="flex flex-wrap items-center gap-2">
          <span className={cn(SUPPORT_LABEL_CLASS, 'font-bold')}>첨부파일</span>
          <span className="text-ink-muted text-[17px]">{ATTACHMENT_NOTICE}</span>
        </p>
        {/* 시안: 라벨 폭에 맞는 작은 버튼. 블록 <label> 이라 전폭으로 늘어나던 것을 막는다. */}
        <label className="w-fit rounded-[5px] border border-[#d5d9df] bg-[#e7e7e7] px-4 text-[17px] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-focus)]">
          <span className="text-ink flex h-10 items-center">파일 선택</span>
          <input
            type="file"
            name="attachments"
            multiple
            accept=".jpg,.jpeg,.png,.gif,.pdf"
            className="sr-only"
          />
        </label>
        <FieldError message={fieldErrors.attachments} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            id="inquiry-consent"
            name="consent"
            type="checkbox"
            className="focus-visible:outline-focus size-[30px] shrink-0 appearance-none rounded-[5px] border-[1.5px] border-[#d5d9df] bg-white checked:border-[#2a2a2a] checked:bg-[#2a2a2a] focus-visible:outline-2 focus-visible:outline-offset-2"
          />
          <label htmlFor="inquiry-consent" className="text-[17px] text-[#1e2938]">
            {PRIVACY_CONSENT_LABEL}
          </label>
          <Link
            href={PRIVACY_POLICY_PATH}
            className="text-[17px] text-[#0067ff] underline underline-offset-2"
          >
            {PRIVACY_CONSENT_LINK_LABEL}
          </Link>
        </div>
        <FieldError message={fieldErrors.consent} />
      </div>

      <div className="flex flex-col gap-2">
        <InquirySubmitButton
          disabled={!isAuthenticated}
          describedBy={isAuthenticated ? undefined : SUBMIT_NOTICE_ID}
        />
        {isAuthenticated ? null : (
          <p id={SUBMIT_NOTICE_ID} className="text-ink-muted text-center text-[15px]">
            <Link href={LOGIN_HREF} className="underline underline-offset-4">
              {LOGIN_REQUIRED_INQUIRY_NOTICE}
            </Link>
          </p>
        )}
      </div>
    </form>
  )
}
