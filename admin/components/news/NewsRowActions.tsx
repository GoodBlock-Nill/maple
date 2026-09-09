'use client'

import { useCallback, useState, useTransition } from 'react'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { newsStateAction, type NewsIntent } from '@/lib/actions/news-actions'

import type { NewsStatus } from '@/lib/constants/news'

/**
 * 목록 행의 조작 버튼.
 *
 * 서버 액션을 폼이 아니라 트랜지션 안에서 직접 부른다. 표 전체가 일괄 처리용
 * `<form>` 안에 들어 있어 폼을 중첩할 수 없고, 중첩하지 않으면 행 버튼이 **선택된
 * 모든 행**을 함께 보내 버리기 때문이다.
 *
 * 액션이 `revalidatePath()` 를 부르므로 응답 하나에 재렌더된 목록이 함께 온다 —
 * 별도의 새로고침 호출이 필요 없다(Next 16 "single response carries data and UI").
 */

type NewsRowActionsProps = {
  id: string
  title: string
  status: NewsStatus
  /** 사용자 사이트의 상세 URL. 발행 전이면 404 지만 링크는 항상 둔다. */
  previewUrl: string
}

export function NewsRowActions({ id, title, status, previewUrl }: NewsRowActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [isConfirmOpen, setConfirmOpen] = useState(false)
  const { showToast } = useToast()

  const run = useCallback(
    (intent: NewsIntent) => {
      const formData = new FormData()

      formData.set('intent', intent)
      formData.append('ids', id)

      startTransition(async () => {
        const result = await newsStateAction(EMPTY_FORM_STATE, formData)

        if (result.formError !== undefined) {
          showToast(result.formError, 'error')

          return
        }

        showToast(result.message ?? '처리했습니다.', 'success')
        setConfirmOpen(false)
      })
    },
    [id, showToast],
  )

  return (
    <div className="flex items-center justify-end gap-1">
      <Button href={`/news/${id}`} variant="ghost" size="sm">
        수정
      </Button>

      {/* 관리자 미리보기가 아니라 독자가 실제로 보는 페이지를 연다. */}
      <Button
        href={previewUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${title} 클라이언트에서 보기`}
        title="클라이언트에서 보기"
        variant="ghost"
        size="sm"
      >
        보기
      </Button>

      {status === 'deleted' ? (
        <Button variant="secondary" size="sm" disabled={isPending} onClick={() => run('restore')}>
          복구
        </Button>
      ) : (
        <>
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => run(status === 'hidden' ? 'unhide' : 'hide')}
          >
            {status === 'hidden' ? '숨김 해제' : '숨김'}
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={isPending}
            onClick={() => setConfirmOpen(true)}
          >
            삭제
          </Button>
        </>
      )}

      <Dialog
        open={isConfirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="뉴스 삭제"
        description={`"${title}" 뉴스를 삭제합니다. 목록의 상태 필터에서 삭제를 골라 복구할 수 있습니다.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={isPending}>
              취소
            </Button>
            <Button variant="danger" onClick={() => run('delete')} disabled={isPending}>
              {isPending ? '삭제 중…' : '삭제'}
            </Button>
          </>
        }
      >
        <p className="text-muted text-[13px]">
          삭제해도 데이터는 남습니다(소프트 삭제). 사용자 사이트에서는 즉시 사라집니다.
        </p>
      </Dialog>
    </div>
  )
}
