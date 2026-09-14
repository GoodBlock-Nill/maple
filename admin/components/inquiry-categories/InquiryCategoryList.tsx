'use client'

import { useActionState, useCallback, useMemo, useState } from 'react'

import { InquiryCategoryFormDialog } from '@/components/inquiry-categories/InquiryCategoryFormDialog'
import { InquiryCategoryRow } from '@/components/inquiry-categories/InquiryCategoryRow'
import { Button, Card, CardHeader, useToast } from '@/components/ui'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { reorderInquiryCategoriesAction } from '@/lib/actions/inquiry-category-order-actions'
import { hasOrderChanged, moveOrder, normalizeOrder } from '@/lib/utils/sort-order'

import type { FormState } from '@/lib/actions/form-state'
import type { InquiryKind } from '@/lib/constants/inquiry-kind'
import type { AdminInquiryCategory } from '@/lib/data/inquiry-categories'

/**
 * 한 창구(kind)의 카테고리 목록 + 순서 저장.
 *
 * 화면은 이 카드를 셋 그린다(1:1 문의 · 버그제보 · 불법이용제보). 순서·저장 버튼이
 * 섹션마다 따로인 이유는 `sort_order` 가 **kind 안에서의 순서**이기 때문이다
 * (마이그레이션 20260914000100) — 한 버튼으로 셋을 저장하면 서로의 순번을 덮어쓴다.
 *
 * 화면 상태로 들고 있는 것은 **순서(id 나열)뿐**이다. 항목의 내용·활성 여부는 매번
 * 서버가 준 배열에서 읽는다 — 항목 자체를 상태로 복사하면 토글·수정 뒤 서버가 새 값을
 * 보내도 화면이 예전 값을 계속 그린다(FAQ 화면에서 실제로 겪은 버그다).
 *
 * 항목이 추가·삭제되면 부모가 `key` 에 넣은 id 나열이 달라져 이 컴포넌트가 새로
 * 마운트된다. 그래서 순서 상태를 동기화하는 이펙트가 필요 없다.
 */
export function InquiryCategoryList({
  kind,
  title,
  categories,
  canWrite,
}: {
  /** 이 섹션의 창구. 정렬 저장과 '추가' 다이얼로그가 함께 실어 보낸다. */
  kind: InquiryKind
  /** 섹션 제목('1:1 문의' · '버그제보' · '불법이용제보'). */
  title: string
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
        title={`${title} (${items.length})`}
        action={
          canWrite ? (
            <div className="flex items-center gap-2">
              <form action={formAction}>
                <input type="hidden" name="ids" value={orderIds.join(',')} />
                {/* 어느 창구의 순서를 저장했는지는 감사 로그에만 남는다(id 나열만으로는
                    나중에 되짚을 수 없다). 액션은 이 값을 다시 검증한다. */}
                <input type="hidden" name="kind" value={kind} />
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
                defaultKind={kind}
                triggerLabel="카테고리 추가"
                triggerVariant="secondary"
                triggerSize="sm"
              />
            </div>
          ) : null
        }
      />

      {items.length === 0 ? (
        <p className="text-muted px-5 py-8 text-center text-[13px]">
          이 종류에 등록된 카테고리가 없습니다.
        </p>
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
