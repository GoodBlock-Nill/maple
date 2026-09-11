'use client'

import { useActionState, useCallback } from 'react'

import { InquiryReplyTemplateDeleteButton } from '@/components/inquiry-reply-templates/InquiryReplyTemplateDeleteButton'
import { InquiryReplyTemplateFormDialog } from '@/components/inquiry-reply-templates/InquiryReplyTemplateFormDialog'
import { Badge, Button, useToast } from '@/components/ui'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { toggleInquiryReplyTemplateAction } from '@/lib/actions/inquiry-reply-template-actions'

import type { FormState } from '@/lib/actions/form-state'
import type {
  AdminInquiryReplyTemplate,
  InquiryReplyTemplateCategory,
} from '@/lib/data/inquiry-reply-templates'

/** 본문 미리보기 한 줄. 줄바꿈을 가운뎃점으로 접어 목록의 높이를 흔들지 않는다. */
function bodySummary(body: string): string {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .join(' · ')
}

/**
 * 템플릿 한 줄 — 순서 이동 · 사용 토글 · 수정 · 삭제.
 *
 * 순서 이동은 부모가 들고 있는 배열을 바꿀 뿐 저장하지 않는다. 여러 번 옮긴 뒤 한 번에
 * 저장하는 편이 왕복도 적고 중간 상태가 남지 않는다(카테고리 화면과 같은 규격).
 */
export function InquiryReplyTemplateRow({
  template,
  categories,
  index,
  total,
  onMove,
  canWrite,
}: {
  template: AdminInquiryReplyTemplate
  categories: readonly InquiryReplyTemplateCategory[]
  index: number
  total: number
  onMove: (id: string, direction: 'up' | 'down') => void
  canWrite: boolean
}) {
  const { showToast } = useToast()

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await toggleInquiryReplyTemplateAction(prevState, formData)

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
            aria-label={`${template.name} 위로`}
            disabled={index === 0}
            onClick={() => onMove(template.id, 'up')}
            className="h-6 px-2 text-[11px]"
          >
            ▲
          </Button>
          <Button
            size="sm"
            variant="secondary"
            aria-label={`${template.name} 아래로`}
            disabled={index === total - 1}
            onClick={() => onMove(template.id, 'down')}
            className="h-6 px-2 text-[11px]"
          >
            ▼
          </Button>
        </span>
      )}

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-ink text-[14px] font-semibold">{template.name}</span>
        <span className="text-muted line-clamp-2 text-[12px]">{bodySummary(template.body)}</span>
      </span>

      {template.isActive ? <Badge tone="success">사용</Badge> : <Badge tone="neutral">중지</Badge>}

      {canWrite && (
        <>
          <form action={formAction}>
            <input type="hidden" name="templateId" value={template.id} />
            <input type="hidden" name="isActive" value={template.isActive ? 'false' : 'true'} />
            <Button type="submit" variant="ghost" size="sm" disabled={isPending}>
              {template.isActive ? '끄기' : '켜기'}
            </Button>
          </form>

          <InquiryReplyTemplateFormDialog
            template={template}
            categories={categories}
            triggerLabel="수정"
            triggerVariant="secondary"
          />
          <InquiryReplyTemplateDeleteButton templateId={template.id} name={template.name} />
        </>
      )}
    </li>
  )
}
