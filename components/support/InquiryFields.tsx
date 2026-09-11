'use client'

import { FormRow } from '@/components/support/InquiryFormRow'
import { SUPPORT_FIELD_CLASS, SUPPORT_INPUT_CLASS } from '@/components/support/support-styles'
import { useAutoGrowTextarea, useInquiryPrefill } from '@/components/support/use-inquiry-prefill'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  INQUIRY_ACCOUNT_HELP,
  INQUIRY_ACCOUNT_LABEL,
  INQUIRY_ACCOUNT_PLACEHOLDER,
  INQUIRY_CATEGORY_PLACEHOLDER,
  INQUIRY_PREFILL_CONFIRM_DESCRIPTION,
  INQUIRY_PREFILL_CONFIRM_LABEL,
  INQUIRY_PREFILL_CONFIRM_TITLE,
  INQUIRY_SUBTYPE_LOCKED_PLACEHOLDER,
  INQUIRY_SUBTYPE_PLACEHOLDER,
} from '@/lib/constants/support'
import { INQUIRY_SUBTYPE_FALLBACK } from '@/lib/utils/inquiry-subtypes'
import { ACCOUNT_ID_MAX, INQUIRY_CONTENT_MAX, INQUIRY_TITLE_MAX } from '@/lib/validation/inquiry'
import { cn } from '@/lib/utils/cn'

import type { InquiryCategoryOption } from '@/types/domain'

const SELECT_CLASS = cn(SUPPORT_FIELD_CLASS, 'support-select rounded-panel h-10 pr-10 pl-[14px]')

const CONFIRM_CLASS =
  'cta-dark rounded-pill focus-visible:outline-focus inline-flex h-11 items-center justify-center ' +
  'px-5 text-[15px] font-semibold transition-[filter] hover:brightness-125 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2'

/**
 * 고를 것이 없는 셀렉트가 대신 말하는 문구.
 *
 * 세 상태를 한 자리에서 읽히게 모아 둔다 — 카테고리 이전 · 고를 수 있음 ·
 * 고를 것이 없어 '기타' 로 접수됨.
 */
function subtypePlaceholder(isCategoryChosen: boolean, hasSubtypes: boolean): string {
  if (!isCategoryChosen) {
    return INQUIRY_SUBTYPE_LOCKED_PLACEHOLDER
  }

  return hasSubtypes ? INQUIRY_SUBTYPE_PLACEHOLDER : INQUIRY_SUBTYPE_FALLBACK
}

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
  /**
   * 접수 모드의 계정 ID 초깃값. 프로필에 연동된 월드 UID(`profiles.msw_uid`)를
   * 미리 채워 두면 대부분의 사용자는 값을 다시 옮겨 적지 않아도 된다(수정 가능).
   */
  defaultAccountId?: string
  fieldErrors: Record<string, string>
}

/**
 * 문의 본문 입력 4종(계정 ID · 카테고리/유형 · 제목 · 내용).
 *
 * 접수 폼과 수정 폼이 **같은 마크업**을 쓰도록 떼어 냈다. 나누면 한쪽만 고쳐져
 * 같은 값을 다르게 검증하거나(예: 셀렉트 옵션) 다르게 보이는 화면이 생긴다.
 *
 * 카테고리 · 세부 유형 · 내용이 제어 입력이다 — 카테고리를 고르면 그 카테고리의
 * 양식이 내용에 채워지고(`docs/1on1.md`) 유형 셀렉트가 그 카테고리의 세부 유형으로
 * 다시 채워진다. 바꿀 때 사용자가 쓴 내용이 있으면 확인을 한 번 세운다. 나머지
 * 입력은 `defaultValue` 로만 채우는 비제어 입력이다.
 *
 * 세부 유형이 없는 카테고리에서는 셀렉트를 잠그고 hidden 으로 `기타` 를 싣는다.
 * 셀렉트를 통째로 지우지 않는 이유는 두 칸짜리 격자가 한 칸으로 줄었다 늘었다
 * 하는 것을 막기 위해서다 — 고를 것이 없다는 사실은 잠긴 셀렉트가 그대로 말한다.
 */
export function InquiryFields({
  categories,
  values,
  defaultAccountId = '',
  fieldErrors,
}: InquiryFieldsProps) {
  const prefill = useInquiryPrefill({
    categories,
    initialCategory: values?.category ?? '',
    initialContent: values?.content ?? '',
    initialType: values?.type ?? '',
  })
  /* 고를 것이 없는 두 경우 — 카테고리 미선택, 세부 유형이 없는 카테고리. 앞은
     "먼저 카테고리를 고르라"고, 뒤는 저장될 값(기타)을 그대로 보여 준다. */
  const hasSubtypes = prefill.subtypes.length > 0
  const isCategoryChosen = prefill.category !== ''
  const contentRef = useAutoGrowTextarea(prefill.content)

  return (
    <>
      <FormRow
        label={INQUIRY_ACCOUNT_LABEL}
        htmlFor="inquiry-account"
        error={fieldErrors.accountId}
        required
        hint={INQUIRY_ACCOUNT_HELP}
      >
        <input
          id="inquiry-account"
          name="accountId"
          type="text"
          required
          maxLength={ACCOUNT_ID_MAX}
          /* 숫자 키패드를 띄우되 숫자만 받지는 않는다 — 서식은 스키마가 정하고,
             영문이 섞인 ID 를 든 사용자가 문의를 못 남기는 일을 만들지 않는다. */
          inputMode="numeric"
          placeholder={INQUIRY_ACCOUNT_PLACEHOLDER}
          defaultValue={values?.accountId ?? defaultAccountId}
          aria-describedby="inquiry-account-hint"
          /* 시안 v2: 계정 ID 만 345 폭 알약이다(값이 17자리로 짧고 고정 폭이다). */
          className={cn(SUPPORT_INPUT_CLASS, 'rounded-pill sm:max-w-[345px]')}
        />
      </FormRow>

      <FormRow
        label="카테고리 및 유형 선택"
        htmlFor="inquiry-category"
        error={fieldErrors.category ?? fieldErrors.type}
        required
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select
            id="inquiry-category"
            name="category"
            required
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
            required
            value={hasSubtypes ? prefill.type : ''}
            onChange={(event) => prefill.setType(event.target.value)}
            disabled={!hasSubtypes}
            aria-label="세부 문의 유형 선택"
            className={cn(SELECT_CLASS, hasSubtypes ? null : 'text-ink-muted')}
          >
            <option value="" disabled>
              {subtypePlaceholder(isCategoryChosen, hasSubtypes)}
            </option>
            {prefill.subtypes.map((subtype) => (
              <option key={subtype} value={subtype}>
                {subtype}
              </option>
            ))}
          </select>

          {/* 잠긴 셀렉트는 전송되지 않는다. 저장될 값은 여기서 싣는다. */}
          {isCategoryChosen && !hasSubtypes ? (
            <input type="hidden" name="type" value={INQUIRY_SUBTYPE_FALLBACK} />
          ) : null}
        </div>

        {prefill.description === null ? null : (
          <p id="inquiry-category-hint" className="text-ink-muted text-[14px] leading-[1.5]">
            {prefill.description}
          </p>
        )}
      </FormRow>

      <FormRow label="제목" htmlFor="inquiry-title" error={fieldErrors.title} required>
        <input
          id="inquiry-title"
          name="title"
          type="text"
          required
          maxLength={INQUIRY_TITLE_MAX}
          placeholder="제목을 입력해 주세요."
          defaultValue={values?.title ?? ''}
          className={SUPPORT_INPUT_CLASS}
        />
      </FormRow>

      <FormRow label="문의 내용" htmlFor="inquiry-body" error={fieldErrors.content} required>
        <textarea
          id="inquiry-body"
          ref={contentRef}
          name="content"
          rows={6}
          required
          maxLength={INQUIRY_CONTENT_MAX}
          placeholder="내용을 입력해 주세요."
          value={prefill.content}
          onChange={(event) => prefill.setContent(event.target.value)}
          /* 시안의 150 은 **빈 칸의** 높이다. 실제 높이는 내용에 맞춰
             `useAutoGrowTextarea` 가 인라인 스타일로 다시 잡는다(카테고리 양식은
             3~13줄로 길이가 제각각이다). */
          className={cn(SUPPORT_FIELD_CLASS, 'rounded-panel h-[150px] resize-none px-4 py-2.5')}
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
