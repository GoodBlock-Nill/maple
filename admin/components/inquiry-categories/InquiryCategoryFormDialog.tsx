'use client'

import { useActionState, useCallback, useState } from 'react'

import { kindMoveOf } from '@/components/inquiry-categories/category-kind-move'
import { InquiryCategoryFormFooter } from '@/components/inquiry-categories/InquiryCategoryFormFooter'
import { InquiryCategorySubtypeEditor } from '@/components/inquiry-categories/InquiryCategorySubtypeEditor'
import { Button, Dialog, FormBanner, Input, Select, Textarea, useToast } from '@/components/ui'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import {
  createInquiryCategoryAction,
  updateInquiryCategoryAction,
} from '@/lib/actions/inquiry-category-actions'
import { DEFAULT_INQUIRY_KIND, INQUIRY_KINDS } from '@/lib/constants/inquiry-kind'
import {
  INQUIRY_CATEGORY_DESCRIPTION_MAX,
  INQUIRY_CATEGORY_LABEL_MAX,
  INQUIRY_CATEGORY_PREFILL_MAX,
} from '@/lib/validation/inquiry-categories'

import type { FormState } from '@/lib/actions/form-state'
import type { InquiryKind } from '@/lib/constants/inquiry-kind'
import type { AdminInquiryCategory } from '@/lib/data/inquiry-categories'

const KIND_OPTIONS = INQUIRY_KINDS.map((kind) => ({ value: kind.value, label: kind.label }))

/**
 * 카테고리 등록 · 수정 다이얼로그.
 *
 * 프리필은 **평문**이다. 사용자 폼의 textarea 에 그대로 들어가므로 마크다운은 해석되지
 * 않고 줄바꿈만 살아남는다. 미리보기를 같은 방식(`whitespace-pre-line`)으로 그려서
 * 저장 전에 사용자가 볼 모습을 확인하게 한다.
 *
 * 이름을 바꾸면 그 이름으로 접수된 과거 문의의 분류도 함께 바뀐다 — 되돌리기 어려운
 * 조작이라 그 사실을 폼 안에 적어 둔다(실제 반영 건수는 저장 뒤 토스트에 나온다).
 *
 * 세부 문의 유형은 사용자 폼의 **유형 셀렉트**가 된다. 프리필 양식에 같은 목록을
 * 다시 적지 않는다 — 두 곳에 두면 사용자가 같은 것을 두 번 고르고, 둘이 어긋난
 * 문의가 들어온다(마이그레이션 20260910000700 · 20260910000800).
 *
 * 종류(창구)를 바꾸면 이 카테고리로 접수된 **과거 문의까지** 그 창구로 옮겨 간다.
 * 접수된 문의가 있을 때만 저장 앞에 확인 한 걸음을 둔다(`InquiryCategoryKindConfirm`) —
 * 0건이면 잃을 것이 없고, 모든 저장에 확인을 붙이면 확인이 의미를 잃는다.
 */
export function InquiryCategoryFormDialog({
  category,
  defaultKind = DEFAULT_INQUIRY_KIND,
  triggerLabel,
  triggerVariant = 'primary',
  triggerSize,
}: {
  /** 없으면 등록, 있으면 수정. */
  category?: AdminInquiryCategory
  /** 등록 폼이 미리 고를 종류. 섹션의 '카테고리 추가' 가 자기 창구를 넘긴다. */
  defaultKind?: InquiryKind
  triggerLabel: string
  triggerVariant?: 'primary' | 'secondary'
  triggerSize?: 'sm' | 'md'
}) {
  const [isOpen, setOpen] = useState(false)
  const [prefill, setPrefill] = useState(category?.prefill ?? '')
  const [kind, setKind] = useState<InquiryKind>(category?.kind ?? defaultKind)
  /* 종류를 바꾼 채 저장을 누르면 버튼 줄이 확인으로 바뀐다. 종류를 되돌리면
     `movesInquiries` 가 false 가 되어 확인도 함께 사라진다. */
  const [isConfirming, setConfirming] = useState(false)
  /* 다이얼로그를 닫았다 열면 편집기가 처음 값으로 돌아가야 한다(등록 폼은 빈 목록,
     수정 폼은 저장된 목록). 목록 상태는 편집기가 들고 있으므로 key 로 다시 마운트한다. */
  const [formKey, setFormKey] = useState(0)
  const { showToast } = useToast()
  const isEdit = category !== undefined

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = isEdit
        ? await updateInquiryCategoryAction(prevState, formData)
        : await createInquiryCategoryAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        setOpen(false)
        setFormKey((current) => current + 1)

        setConfirming(false)

        if (!isEdit) {
          setPrefill('')
          setKind(defaultKind)
        }
      }

      return result
    },
    [defaultKind, isEdit, showToast],
  )

  const [state, formAction, isPending] = useActionState(run, EMPTY_FORM_STATE)
  /* 접수된 문의가 있는 카테고리의 창구를 옮기는 경우에만 확인을 세운다. */
  const kindMove = kindMoveOf(category, kind)

  return (
    <>
      <Button
        variant={triggerVariant}
        size={triggerSize ?? (isEdit ? 'sm' : 'md')}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => setOpen(false)}
        title={isEdit ? '카테고리 수정' : '카테고리 등록'}
        description="사용자 사이트 고객지원 폼(1:1 문의 · 버그제보 · 불법이용제보)의 카테고리 선택과 문의 내용 프리필에 그대로 쓰입니다."
      >
        <form action={formAction} className="flex flex-col gap-4" noValidate>
          {isEdit && <input type="hidden" name="categoryId" value={category.id} />}

          <FormBanner message={state.formError} />

          <Input
            label="이름"
            name="label"
            required
            maxLength={INQUIRY_CATEGORY_LABEL_MAX}
            defaultValue={category?.label ?? ''}
            hint={
              isEdit
                ? '문의 폼의 카테고리 선택에 그대로 보입니다. 이름을 바꾸면 이 분류로 접수된 기존 문의도 함께 새 이름으로 옮겨집니다.'
                : '문의 폼의 카테고리 선택에 그대로 보입니다.'
            }
            error={state.fieldErrors?.label}
          />

          <Select
            label="종류"
            name="kind"
            options={KIND_OPTIONS}
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as InquiryKind)
              setConfirming(false)
            }}
            hint="이 카테고리가 보일 접수 창구입니다. 사용자 사이트의 1:1 문의 · 버그제보 · 불법이용제보 폼이 각자의 카테고리만 보여 줍니다."
            error={state.fieldErrors?.kind}
          />

          <Input
            label="설명"
            name="description"
            maxLength={INQUIRY_CATEGORY_DESCRIPTION_MAX}
            defaultValue={category?.description ?? ''}
            hint="카테고리 선택 아래 한 줄로 보입니다. 비워 두면 아무것도 나오지 않습니다."
            error={state.fieldErrors?.description}
          />

          <Textarea
            label="프리필(문의 내용 양식)"
            name="prefill"
            rows={8}
            maxLength={INQUIRY_CATEGORY_PREFILL_MAX}
            value={prefill}
            onChange={(event) => setPrefill(event.target.value)}
            hint="사용자가 이 카테고리를 고르면 문의 내용 칸에 그대로 채워집니다. 줄바꿈은 그대로 살아납니다."
            error={state.fieldErrors?.prefill}
          />

          <InquiryCategorySubtypeEditor
            key={formKey}
            defaultSubtypes={category?.subtypes ?? []}
            error={state.fieldErrors?.subtypes}
          />

          <InquiryCategoryFormFooter
            prefill={prefill}
            isEdit={isEdit}
            isPending={isPending}
            isActive={category?.isActive ?? true}
            kindMove={kindMove}
            isConfirming={isConfirming}
            onClose={() => setOpen(false)}
            onConfirm={() => setConfirming(true)}
            onCancelConfirm={() => setConfirming(false)}
          />
        </form>
      </Dialog>
    </>
  )
}
