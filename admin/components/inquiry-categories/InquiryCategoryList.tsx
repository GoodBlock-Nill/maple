'use client'

import { useActionState, useCallback, useMemo, useState } from 'react'

import { InquiryCategoryFormDialog } from '@/components/inquiry-categories/InquiryCategoryFormDialog'
import { InquiryCategoryRow } from '@/components/inquiry-categories/InquiryCategoryRow'
import { Button, Card, CardHeader, useToast } from '@/components/ui'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { reorderInquiryCategoriesAction } from '@/lib/actions/inquiry-category-actions'
import { hasOrderChanged, moveOrder, normalizeOrder } from '@/lib/utils/sort-order'

import type { FormState } from '@/lib/actions/form-state'
import type { AdminInquiryCategory } from '@/lib/data/inquiry-categories'

/**
 * 카테고리 목록 + 순서 저장.
 *
 * 화면 상태로 들고 있는 것은 **순서(id 나열)뿐**이다. 항목의 내용·활성 여부는 매번
 * 서버가 준 배열에서 읽는다 — 항목 자체를 상태로 복사하면 토글·수정 뒤 서버가 새 값을
 * 보내도 화면이 예전 값을 계속 그린다(FAQ 화면에서 실제로 겪은 버그다).
 *
 * 항목이 추가·삭제되면 부모가 `key` 에 넣은 id 나열이 달라져 이 컴포넌트가 새로
 * 마운트된다. 그래서 순서 상태를 동기화하는 이펙트가 필요 없다.
 */
export function InquiryCategoryList({
  categories,
  canWrite,
}: {
  categories: readonly AdminInquiryCategory[]
  canWrite: boolean
}) {
  const [orderIds, setOrderIds] = useState<readonly string[]>(() =>
    categories.map((category) => category.id),
  )
  const { showToast } = useToast()

  const items = useMemo<readonly AdminInquiryCategory[]>(
    () =>
      orderIds
        .map((id) => categories.find((category) => category.id === id))
        .filter((category): category is AdminInquiryCategory => category !== undefined),
    [orderIds, categories],
  )

  const move = useCallback((id: string, direction: 'up' | 'down') => {
    setOrderIds((current) =>
      moveOrder(normalizeOrder(current), id, direction).map((entry) => entry.id),
    )
  }, [])

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await reorderInquiryCategoriesAction(prevState, formData)

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
    normalizeOrder(categories.map((category) => category.id)),
    normalizeOrder(orderIds),
  )

  return (
    <Card>
      <CardHeader
        title={`카테고리 (${items.length})`}
        action={
          canWrite ? (
            <div className="flex items-center gap-2">
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
              <InquiryCategoryFormDialog
                triggerLabel="카테고리 추가"
                triggerVariant="secondary"
                triggerSize="sm"
              />
            </div>
          ) : null
        }
      />

      {items.length === 0 ? (
        <p className="text-muted px-5 py-8 text-center text-[13px]">등록된 카테고리가 없습니다.</p>
      ) : (
        <ul>
          {items.map((category, index) => (
            <InquiryCategoryRow
              key={category.id}
              category={category}
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
