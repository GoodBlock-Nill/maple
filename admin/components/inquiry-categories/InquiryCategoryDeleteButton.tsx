'use client'

import { useActionState, useCallback, useState } from 'react'

import { Button, Dialog, FormBanner, useToast } from '@/components/ui'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { deleteInquiryCategoryAction } from '@/lib/actions/inquiry-category-actions'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 카테고리 삭제 + 확인 다이얼로그.
 *
 * 이 분류로 접수된 문의가 있으면 **삭제 자체를 열지 않는다.** 지우는 순간 그 문의들의
 * 분류는 어디에도 정의되지 않은 문자열이 되어, 목록 필터에서 사라지고 통계가 갈린다.
 * 대신 무엇이 막고 있는지(건수)와 다음 행동(비활성화)을 그 자리에 적는다.
 */
export function InquiryCategoryDeleteButton({
  categoryId,
  label,
  usageCount,
}: {
  categoryId: string
  label: string
  /** 이 라벨로 접수된 문의 수. 0 일 때만 삭제할 수 있다. */
  usageCount: number
}) {
  const [isOpen, setOpen] = useState(false)
  const { showToast } = useToast()
  const isDeletable = usageCount === 0

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await deleteInquiryCategoryAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        setOpen(false)
      }

      return result
    },
    [showToast],
  )

  const [state, formAction, isPending] = useActionState(run, EMPTY_FORM_STATE)

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        삭제
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => setOpen(false)}
        title="카테고리 삭제"
        description={
          isDeletable
            ? '되돌릴 수 없습니다. 사용자 폼에서 잠시 감추려는 것이라면 삭제 대신 비활성화하세요.'
            : '이 카테고리로 접수된 문의가 있어 삭제할 수 없습니다. 비활성화하면 사용자 폼에서는 사라지고 기존 문의의 분류는 그대로 남습니다.'
        }
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="categoryId" value={categoryId} />

          <p className="text-ink text-[13px]">
            {label}
            <span className="text-muted"> · 접수된 문의 {usageCount}건</span>
          </p>

          <FormBanner message={state.formError} />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              취소
            </Button>
            <Button variant="danger" type="submit" disabled={isPending || !isDeletable}>
              {isPending ? '삭제 중…' : '삭제'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}
