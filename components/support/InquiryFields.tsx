import { FormRow } from '@/components/support/InquiryFormRow'
import { SUPPORT_FIELD_CLASS, SUPPORT_INPUT_CLASS } from '@/components/support/support-styles'
import { INQUIRY_CATEGORIES, INQUIRY_TYPES } from '@/lib/constants/support'
import { cn } from '@/lib/utils/cn'

const SELECT_CLASS = cn(SUPPORT_FIELD_CLASS, 'support-select rounded-panel h-10 pr-10 pl-[14px]')

/** 접수와 수정이 공유하는 입력값. 수정 화면은 여기에 저장된 값을 그대로 채운다. */
export type InquiryFormValues = {
  accountId: string
  category: string
  type: string
  title: string
  content: string
}

type InquiryFieldsProps = {
  /** 수정 모드에서 채워 넣는 기존 값. 접수 모드에서는 undefined. */
  values?: InquiryFormValues
  fieldErrors: Record<string, string>
}

/**
 * 문의 본문 입력 4종(계정 ID · 카테고리/유형 · 제목 · 내용).
 *
 * 접수 폼과 수정 폼이 **같은 마크업**을 쓰도록 떼어 냈다. 나누면 한쪽만 고쳐져
 * 같은 값을 다르게 검증하거나(예: 셀렉트 옵션) 다르게 보이는 화면이 생긴다.
 * `defaultValue` 로만 채우는 비제어 입력이라 상태를 들고 있지 않는다.
 */
export function InquiryFields({ values, fieldErrors }: InquiryFieldsProps) {
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
            defaultValue={values?.category ?? ''}
            className={SELECT_CLASS}
          >
            <option value="" disabled>
              카테고리를 선택해주세요
            </option>
            {INQUIRY_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
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
          name="content"
          rows={6}
          placeholder="내용을 입력해 주세요."
          defaultValue={values?.content ?? ''}
          className={cn(SUPPORT_FIELD_CLASS, 'rounded-panel h-[150px] resize-none p-4')}
        />
      </FormRow>
    </>
  )
}
