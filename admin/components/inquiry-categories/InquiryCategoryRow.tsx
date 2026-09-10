'use client'

import { useActionState, useCallback } from 'react'

import { InquiryCategoryDeleteButton } from '@/components/inquiry-categories/InquiryCategoryDeleteButton'
import { InquiryCategoryFormDialog } from '@/components/inquiry-categories/InquiryCategoryFormDialog'
import { Badge, Button, useToast } from '@/components/ui'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { toggleInquiryCategoryAction } from '@/lib/actions/inquiry-category-actions'

import type { FormState } from '@/lib/actions/form-state'
import type { AdminInquiryCategory } from '@/lib/data/inquiry-categories'

/** 프리필 미리보기 한 줄. 줄바꿈을 가운뎃점으로 접어 목록의 높이를 흔들지 않는다. */
function prefillSummary(prefill: string): string {
  return prefill === ''
    ? '프리필 없음'
    : prefill
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')
        .join(' · ')
}

/**
 * 카테고리 한 줄 — 순서 이동 · 활성 토글 · 수정 · 삭제.
 *
 * 순서 이동은 부모가 들고 있는 배열을 바꿀 뿐 저장하지 않는다. 여러 번 옮긴 뒤 한 번에
 * 저장하는 편이 왕복도 적고, 중간 상태가 사용자 화면에 노출되지도 않는다(FAQ 와 같은 규격).
 */
export function InquiryCategoryRow({
  category,
  index,
  total,
  onMove,
  canWrite,
}: {
  category: AdminInquiryCategory
  index: number
  total: number
  onMove: (id: string, direction: 'up' | 'down') => void
  /** 읽기 전용 관리자에게는 순서·활성·수정·삭제를 그리지 않는다. */
  canWrite: boolean
}) {
  const { showToast } = useToast()

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await toggleInquiryCategoryAction(prevState, formData)

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

  return (
    <li className="border-line flex flex-wrap items-center gap-3 border-b px-5 py-3 last:border-b-0">
      {canWrite && (
        <span className="flex flex-col gap-0.5">
          <Button
            size="sm"
            variant="secondary"
            aria-label={`${category.label} 위로`}
            disabled={index === 0}
            onClick={() => onMove(category.id, 'up')}
            className="h-6 px-2 text-[11px]"
          >
            ▲
          </Button>
          <Button
            size="sm"
            variant="secondary"
            aria-label={`${category.label} 아래로`}
            disabled={index === total - 1}
            onClick={() => onMove(category.id, 'down')}
            className="h-6 px-2 text-[11px]"
          >
            ▼
          </Button>
        </span>
      )}

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-ink text-[14px] font-semibold">
          {category.label}
          <span className="text-muted ml-2 text-[12px] font-normal">
            문의 {category.usageCount}건
          </span>
        </span>
        <span className="text-muted line-clamp-1 text-[12px]">
          {category.description ?? '설명 없음'}
        </span>
        <span className="text-muted line-clamp-1 text-[12px]">
          {prefillSummary(category.prefill)}
        </span>
        {/* 세부 유형이 없으면 사용자 폼이 유형 셀렉트를 잠그고 '기타' 로 접수한다 —
            숫자만이 아니라 그 사실까지 한 줄로 보여 준다. */}
        <span className="text-muted line-clamp-1 text-[12px]">
          {category.subtypes.length === 0
            ? '세부 유형 없음 (기타로 접수)'
            : `세부 유형 ${category.subtypes.length}개 · ${category.subtypes.join(' · ')}`}
        </span>
      </span>

      {category.isActive ? <Badge tone="success">노출</Badge> : <Badge tone="neutral">숨김</Badge>}

      {canWrite && (
        <>
          <form action={formAction}>
            <input type="hidden" name="categoryId" value={category.id} />
            <input type="hidden" name="isActive" value={category.isActive ? 'false' : 'true'} />
            <Button type="submit" variant="ghost" size="sm" disabled={isPending}>
              {category.isActive ? '숨기기' : '노출'}
            </Button>
          </form>

          <InquiryCategoryFormDialog
            category={category}
            triggerLabel="수정"
            triggerVariant="secondary"
          />
          <InquiryCategoryDeleteButton
            categoryId={category.id}
            label={category.label}
            usageCount={category.usageCount}
          />
        </>
      )}
    </li>
  )
}
