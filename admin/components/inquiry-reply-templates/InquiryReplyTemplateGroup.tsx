'use client'

import { useActionState, useCallback, useMemo, useState } from 'react'

import { InquiryReplyTemplateFormDialog } from '@/components/inquiry-reply-templates/InquiryReplyTemplateFormDialog'
import { InquiryReplyTemplateRow } from '@/components/inquiry-reply-templates/InquiryReplyTemplateRow'
import { Badge, Button, Card, CardHeader, useToast } from '@/components/ui'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { reorderInquiryReplyTemplatesAction } from '@/lib/actions/inquiry-reply-template-actions'
import { hasOrderChanged, moveOrder, normalizeOrder } from '@/lib/utils/sort-order'

import type { FormState } from '@/lib/actions/form-state'
import type {
  AdminInquiryReplyTemplate,
  InquiryReplyTemplateCategory,
  InquiryReplyTemplateGroup as TemplateGroup,
} from '@/lib/data/inquiry-reply-templates'

/**
 * 카테고리 한 묶음 — 목록 + 순서 저장 + 추가.
 *
 * 순서는 **묶음 안에서만** 의미가 있다(답변 화면의 선택 상자가 공통 → 카테고리 순으로
 * 묶어 보여 준다). 그래서 정렬 저장도 묶음마다 따로 둔다 — 한 화면에 저장 버튼이
 * 하나면 어느 묶음을 저장하는지 알 수 없다.
 *
 * 화면 상태로 들고 있는 것은 **순서(id 나열)뿐**이다. 항목의 내용·사용 여부는 매번
 * 서버가 준 배열에서 읽는다 — 항목 자체를 상태로 복사하면 토글·수정 뒤 화면이 옛 값을
 * 계속 그린다(카테고리 화면과 같은 규격).
 */
export function InquiryReplyTemplateGroup({
  group,
  categories,
  canWrite,
}: {
  group: TemplateGroup
  categories: readonly InquiryReplyTemplateCategory[]
  canWrite: boolean
}) {
  const [orderIds, setOrderIds] = useState<readonly string[]>(() =>
    group.templates.map((template) => template.id),
  )
  const { showToast } = useToast()

  const items = useMemo<readonly AdminInquiryReplyTemplate[]>(
    () =>
      orderIds
        .map((id) => group.templates.find((template) => template.id === id))
        .filter((template): template is AdminInquiryReplyTemplate => template !== undefined),
    [orderIds, group.templates],
  )

  const move = useCallback((id: string, direction: 'up' | 'down') => {
    setOrderIds((current) =>
      moveOrder(normalizeOrder(current), id, direction).map((entry) => entry.id),
    )
  }, [])

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await reorderInquiryReplyTemplatesAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
      }

      if (result.formError !== undefined) {
        showToast(result.formError, 'error')
      }

      return result
    },
    [showToast],
  )

  const [, formAction, isPending] = useActionState(run, EMPTY_FORM_STATE)
  const isDirty = hasOrderChanged(
    normalizeOrder(group.templates.map((template) => template.id)),
    normalizeOrder(orderIds),
  )

  return (
    <Card>
      <CardHeader
        title={`${group.label} (${items.length})`}
        action={
          <div className="flex items-center gap-2">
            {!group.isCategoryActive && <Badge tone="neutral">숨긴 카테고리</Badge>}
            {canWrite && (
              <>
                {items.length > 1 && (
                  <form action={formAction}>
                    <input type="hidden" name="ids" value={orderIds.join(',')} />
                    <Button
                      type="submit"
                      size="sm"
                      variant="secondary"
                      disabled={!isDirty || isPending}
                    >
                      {isPending ? '저장 중…' : '순서 저장'}
                    </Button>
                  </form>
                )}
                <InquiryReplyTemplateFormDialog
                  categories={categories}
                  defaultCategoryId={group.categoryId}
                  triggerLabel="템플릿 추가"
                  triggerVariant="secondary"
                  triggerSize="sm"
                />
              </>
            )}
          </div>
        }
      />

      {items.length === 0 ? (
        <p className="text-muted px-5 py-6 text-center text-[13px]">
          등록된 템플릿이 없습니다. 이 분류의 문의에서는 공통 템플릿만 보입니다.
        </p>
      ) : (
        <ul>
          {items.map((template, index) => (
            <InquiryReplyTemplateRow
              key={template.id}
              template={template}
              categories={categories}
              index={index}
              total={items.length}
              onMove={move}
              canWrite={canWrite}
            />
          ))}
        </ul>
      )}
    </Card>
  )
}
