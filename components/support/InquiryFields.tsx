'use client'

import { FormRow } from '@/components/support/InquiryFormRow'
import { SUPPORT_FIELD_CLASS, SUPPORT_INPUT_CLASS } from '@/components/support/support-styles'
import { useAutoGrowTextarea, useInquiryPrefill } from '@/components/support/use-inquiry-prefill'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  INQUIRY_CATEGORY_PLACEHOLDER,
  INQUIRY_PREFILL_CONFIRM_DESCRIPTION,
  INQUIRY_PREFILL_CONFIRM_LABEL,
  INQUIRY_PREFILL_CONFIRM_TITLE,
  INQUIRY_TYPES,
} from '@/lib/constants/support'
import { INQUIRY_CONTENT_MAX } from '@/lib/validation/inquiry'
import { cn } from '@/lib/utils/cn'

import type { InquiryCategoryOption } from '@/types/domain'

const SELECT_CLASS = cn(SUPPORT_FIELD_CLASS, 'support-select rounded-panel h-10 pr-10 pl-[14px]')

const CONFIRM_CLASS =
  'cta-dark rounded-pill focus-visible:outline-focus inline-flex h-11 items-center justify-center ' +
  'px-5 text-[15px] font-semibold transition-[filter] hover:brightness-125 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2'

/** 접수와 수정이 공유하는 입력값. 수정 화면은 여기에 저장된 값을 그대로 채운다. */
export type InquiryFormValues = {
  accountId: string
  category: string
  type: string
  title: string
  content: string
}

type InquiryFieldsProps = {
  /** 서버가 DB(`inquiry_categories`)에서 읽어 넘긴 활성 카테고리. */
  categories: readonly InquiryCategoryOption[]
  /** 수정 모드에서 채워 넣는 기존 값. 접수 모드에서는 undefined. */
  values?: InquiryFormValues
  fieldErrors: Record<string, string>
}

/**
 * 문의 본문 입력 4종(계정 ID · 카테고리/유형 · 제목 · 내용).
 *
 * 접수 폼과 수정 폼이 **같은 마크업**을 쓰도록 떼어 냈다. 나누면 한쪽만 고쳐져
 * 같은 값을 다르게 검증하거나(예: 셀렉트 옵션) 다르게 보이는 화면이 생긴다.
 *
 * 카테고리와 내용만 제어 입력이다 — 카테고리를 고르면 그 카테고리의 양식이
 * 내용에 채워지고(`docs/1on1.md`), 바꿀 때 사용자가 쓴 내용이 있으면 확인을 한 번
 * 세운다. 나머지 입력은 `defaultValue` 로만 채우는 비제어 입력이다.
 */
export function InquiryFields({ categories, values, fieldErrors }: InquiryFieldsProps) {
  const prefill = useInquiryPrefill({
    categories,
    initialCategory: values?.category ?? '',
    initialContent: values?.content ?? '',
  })
  const contentRef = useAutoGrowTextarea(prefill.content)

  return (
    <>
      <FormRow label="글자월드 계정 ID" htmlFor="inquiry-account" error={fieldErrors.accountId}>
        <input
          id="inquiry-account"
          name="accountId"
          type="text"
          inputMode="numeric"
          placeholder="예: 123456789000000"
          defaultValue={values?.accountId ?? ''}
          className={cn(SUPPORT_INPUT_CLASS, 'rounded-pill')}
        />
      </FormRow>

      <FormRow
        label="카테고리 및 유형 선택"
        htmlFor="inquiry-category"
        error={fieldErrors.category ?? fieldErrors.type}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select
            id="inquiry-category"
            name="category"
            value={prefill.category}
            onChange={(event) => prefill.selectCategory(event.target.value)}
            aria-describedby={prefill.description === null ? undefined : 'inquiry-category-hint'}
            className={SELECT_CLASS}
          >
            <option value="" disabled>
              {INQUIRY_CATEGORY_PLACEHOLDER}
            </option>
            {categories.map((category) => (
              <option key={category.key} value={category.label}>
                {category.label}
              </option>
            ))}
          </select>
          <select
            name="type"
            defaultValue={values?.type ?? ''}
            aria-label="유형 선택"
            className={SELECT_CLASS}
          >
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

        {prefill.description === null ? null : (
          <p id="inquiry-category-hint" className="text-ink-muted text-[14px] leading-[1.5]">
            {prefill.description}
          </p>
        )}
      </FormRow>

      <FormRow label="제목" htmlFor="inquiry-title" error={fieldErrors.title}>
        <input
          id="inquiry-title"
          name="title"
          type="text"
          placeholder="제목을 입력해 주세요."
          defaultValue={values?.title ?? ''}
          className={SUPPORT_INPUT_CLASS}
        />
      </FormRow>

      <FormRow label="문의 내용" htmlFor="inquiry-body" error={fieldErrors.content}>
        <textarea
          id="inquiry-body"
          ref={contentRef}
          name="content"
          rows={6}
          maxLength={INQUIRY_CONTENT_MAX}
          placeholder="내용을 입력해 주세요."
          value={prefill.content}
          onChange={(event) => prefill.setContent(event.target.value)}
          /* 시안의 150 은 **빈 칸의** 높이다. 실제 높이는 내용에 맞춰
             `useAutoGrowTextarea` 가 인라인 스타일로 다시 잡는다(카테고리 양식은
             3~13줄로 길이가 제각각이다). */
          className={cn(SUPPORT_FIELD_CLASS, 'rounded-panel h-[150px] resize-none p-4')}
        />
      </FormRow>

      <ConfirmDialog
        open={prefill.pendingLabel !== null}
        title={INQUIRY_PREFILL_CONFIRM_TITLE}
        description={INQUIRY_PREFILL_CONFIRM_DESCRIPTION}
        onCancel={prefill.cancelPending}
        confirm={
          <button type="button" onClick={prefill.confirmPending} className={CONFIRM_CLASS}>
            {INQUIRY_PREFILL_CONFIRM_LABEL}
          </button>
        }
      />
    </>
  )
}
