'use client'

import { useActionState, useCallback } from 'react'

import { FaqDeleteButton } from '@/components/faqs/FaqDeleteButton'
import { FaqFormDialog } from '@/components/faqs/FaqFormDialog'
import { Badge, Button, useToast } from '@/components/ui'
import { toggleFaqPublishAction } from '@/lib/actions/faqs-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'

import type { FormState } from '@/lib/actions/form-state'
import type { FaqItem } from '@/lib/data/faqs'

/**
 * FAQ 한 줄 — 순서 이동 · 발행 토글 · 수정 · 삭제.
 *
 * 순서 이동은 부모(카테고리 섹션)가 들고 있는 배열을 바꿀 뿐 저장하지 않는다.
 * 여러 번 옮긴 뒤 한 번에 저장하는 편이 왕복도 적고, 중간 상태가 사용자 화면에
 * 노출되지도 않는다.
 */
export function FaqRow({
  faq,
  index,
  total,
  onMove,
  canWrite,
}: {
  faq: FaqItem
  index: number
  total: number
  onMove: (id: string, direction: 'up' | 'down') => void
  /** 읽기 전용 관리자에게는 순서·발행·수정·삭제를 그리지 않는다. */
  canWrite: boolean
}) {
  const { showToast } = useToast()

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await toggleFaqPublishAction(prevState, formData)

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
            aria-label={`${faq.question} 위로`}
            disabled={index === 0}
            onClick={() => onMove(faq.id, 'up')}
            className="h-6 px-2 text-[11px]"
          >
            ▲
          </Button>
          <Button
            size="sm"
            variant="secondary"
            aria-label={`${faq.question} 아래로`}
            disabled={index === total - 1}
            onClick={() => onMove(faq.id, 'down')}
            className="h-6 px-2 text-[11px]"
          >
            ▼
          </Button>
        </span>
      )}

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-ink line-clamp-1 text-[14px] font-semibold">{faq.question}</span>
        <span className="text-muted line-clamp-1 text-[12px]">{faq.answer}</span>
      </span>

      {faq.isPublished ? <Badge tone="success">발행</Badge> : <Badge tone="neutral">미발행</Badge>}

      {canWrite && (
        <>
          <form action={formAction}>
            <input type="hidden" name="faqId" value={faq.id} />
            <input type="hidden" name="isPublished" value={faq.isPublished ? 'false' : 'true'} />
            <Button type="submit" variant="ghost" size="sm" disabled={isPending}>
              {faq.isPublished ? '숨기기' : '발행'}
            </Button>
          </form>

          <FaqFormDialog faq={faq} triggerLabel="수정" triggerVariant="secondary" />
          <FaqDeleteButton faqId={faq.id} question={faq.question} />
        </>
      )}
    </li>
  )
}
