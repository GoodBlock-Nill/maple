'use client'

import { useActionState, useCallback, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import {
  setCommentDeletedAction,
  setCommentHiddenAction,
  setPostDeletedAction,
  setPostHiddenAction,
} from '@/lib/actions/moderation-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'

import type { FormState } from '@/lib/actions/form-state'

type Kind = 'post' | 'comment'

const HIDE_ACTION = { post: setPostHiddenAction, comment: setCommentHiddenAction } as const
const DELETE_ACTION = { post: setPostDeletedAction, comment: setCommentDeletedAction } as const
const KIND_LABEL: Record<Kind, string> = { post: '게시글', comment: '댓글' }

/**
 * 목록 행의 조치 버튼 — 숨김/해제 · 삭제/복구.
 *
 * 숨김은 되돌리기 쉬워 즉시 실행하고, 삭제·복구만 확인 다이얼로그를 세운다.
 * 모든 확인을 다이얼로그로 감싸면 운영자가 습관적으로 확인을 눌러 결국 아무것도
 * 막지 못한다.
 *
 * 원문 미리보기와 작성자 이동은 버튼으로 두지 않는다 — 표의 제목·작성자 칸이 이미
 * 같은 곳으로 가는 링크다. 조치 칸이 넓어지면 목록에서 제목 칸이 먼저 줄어든다.
 */
export function ModerationActions({
  kind,
  id,
  isHidden,
  isDeleted,
}: {
  kind: Kind
  id: string
  isHidden: boolean
  isDeleted: boolean
}) {
  const { showToast } = useToast()
  const [isConfirmOpen, setConfirmOpen] = useState(false)

  /* 성공 처리를 이펙트가 아니라 액션 안에서 한다(components/admins 의 선례와 동일).
     이펙트로 두면 같은 결과를 두 번 처리하는 경로가 생긴다. */
  const withToast = useCallback(
    (action: (state: FormState, formData: FormData) => Promise<FormState>) =>
      async (state: FormState, formData: FormData): Promise<FormState> => {
        const result = await action(state, formData)

        if (result.message !== undefined) {
          showToast(result.message, 'success')
          setConfirmOpen(false)
        }

        if (result.formError !== undefined) {
          showToast(result.formError, 'error')
        }

        return result
      },
    [showToast],
  )

  const [, hideAction, isHidePending] = useActionState(
    withToast(HIDE_ACTION[kind]),
    EMPTY_FORM_STATE,
  )
  const [, deleteAction, isDeletePending] = useActionState(
    withToast(DELETE_ACTION[kind]),
    EMPTY_FORM_STATE,
  )

  return (
    <div className="flex items-center justify-end gap-1">
      <form action={hideAction} className="contents">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="on" value={isHidden ? '0' : '1'} />
        <Button type="submit" variant="secondary" size="sm" disabled={isHidePending || isDeleted}>
          {isHidden ? '숨김 해제' : '숨김'}
        </Button>
      </form>

      <Button
        variant={isDeleted ? 'secondary' : 'danger'}
        size="sm"
        onClick={() => setConfirmOpen(true)}
      >
        {isDeleted ? '복구' : '삭제'}
      </Button>

      <Dialog
        open={isConfirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={isDeleted ? `${KIND_LABEL[kind]} 복구` : `${KIND_LABEL[kind]} 삭제`}
        description={
          isDeleted
            ? '삭제 표시를 지워 사용자 사이트에 다시 노출합니다.'
            : '사용자 사이트에서 보이지 않게 합니다. 행은 남으므로 복구할 수 있습니다.'
        }
      >
        <form action={deleteAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="on" value={isDeleted ? '0' : '1'} />

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setConfirmOpen(false)}
              disabled={isDeletePending}
            >
              취소
            </Button>
            <Button
              type="submit"
              variant={isDeleted ? 'primary' : 'danger'}
              disabled={isDeletePending}
            >
              {isDeletePending
                ? isDeleted
                  ? '복구 중…'
                  : '삭제 중…'
                : isDeleted
                  ? '복구'
                  : '삭제'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
