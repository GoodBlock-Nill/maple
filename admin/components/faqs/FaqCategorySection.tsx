'use client'

import { useActionState, useCallback, useMemo, useState } from 'react'

import { FaqFormDialog } from '@/components/faqs/FaqFormDialog'
import { FaqRow } from '@/components/faqs/FaqRow'
import { Button, Card, CardHeader, useToast } from '@/components/ui'
import { reorderFaqsAction } from '@/lib/actions/faqs-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { hasFaqOrderChanged, moveFaqOrder, normalizeFaqOrder } from '@/lib/validation/faqs'

import type { FormState } from '@/lib/actions/form-state'
import type { FaqGroup, FaqItem } from '@/lib/data/faqs'

/**
 * 카테고리 한 묶음.
 *
 * 화면 상태로 들고 있는 것은 **순서(id 나열)뿐**이다. 항목의 내용·발행 여부는 매번
 * 서버가 준 `group.items` 에서 읽는다 — 항목 자체를 상태로 복사하면 발행 토글·수정
 * 뒤 서버가 새 값을 보내도 화면이 예전 값을 계속 그린다(실제로 겪은 버그다).
 *
 * 항목이 추가·삭제되면 부모가 `key` 에 넣은 id 나열이 달라져 이 컴포넌트가 새로
 * 마운트된다. 그래서 순서 상태를 동기화하는 이펙트가 필요 없다.
 */
export function FaqCategorySection({ group, canWrite }: { group: FaqGroup; canWrite: boolean }) {
  const [orderIds, setOrderIds] = useState<readonly string[]>(() =>
    group.items.map((item) => item.id),
  )
  const { showToast } = useToast()

  const items = useMemo<readonly FaqItem[]>(
    () =>
      orderIds
        .map((id) => group.items.find((item) => item.id === id))
        .filter((item): item is FaqItem => item !== undefined),
    [orderIds, group.items],
  )

  const move = useCallback((id: string, direction: 'up' | 'down') => {
    setOrderIds((current) =>
      moveFaqOrder(normalizeFaqOrder(current), id, direction).map((entry) => entry.id),
    )
  }, [])

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await reorderFaqsAction(prevState, formData)

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
  const isDirty = hasFaqOrderChanged(
    normalizeFaqOrder(group.items.map((item) => item.id)),
    normalizeFaqOrder(orderIds),
  )

  return (
    <Card>
      <CardHeader
        title={`${group.label} (${items.length})`}
        action={
          canWrite ? (
            <div className="flex items-center gap-2">
              <form action={formAction}>
                <input type="hidden" name="category" value={group.category} />
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
              <FaqFormDialog
                defaultCategory={group.category}
                triggerLabel="추가"
                triggerVariant="secondary"
                triggerSize="sm"
              />
            </div>
          ) : null
        }
      />

      {items.length === 0 ? (
        <p className="text-muted px-5 py-8 text-center text-[13px]">등록된 항목이 없습니다.</p>
      ) : (
        <ul>
          {items.map((item, index) => (
            <FaqRow
              key={item.id}
              faq={item}
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
