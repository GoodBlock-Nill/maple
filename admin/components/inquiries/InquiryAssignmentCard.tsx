'use client'

import { useActionState, useCallback, useState } from 'react'

import {
  InquiryAssignmentControls,
  type InquiryAssignIntent,
} from '@/components/inquiries/InquiryAssignmentControls'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Dialog,
  FormBanner,
  useToast,
} from '@/components/ui'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import {
  assignInquiryAction,
  unassignInquiryAction,
} from '@/lib/actions/inquiry-assignment-actions'
import { formatDateTime } from '@/lib/utils/format-date'

import type { FormState } from '@/lib/actions/form-state'
import type { AdminListItem } from '@/lib/data/admins'
import type { InquiryAdminRef } from '@/lib/data/inquiries'

/**
 * 담당자 카드 — 누가 이 문의를 맡았는가.
 *
 * 확인 창은 **남의 배정을 건드릴 때만** 세운다(§7.4: 모든 조작을 다이얼로그로
 * 감싸면 확인이 의미를 잃는다). 내가 맡거나 내 배정을 푸는 것은 곧바로 실행한다 —
 * 되돌리는 데 한 번의 클릭이면 되고, 그 사이에 잘못될 것이 없다.
 *
 * 미배정 + '접수 대기' 문의를 맡으면 상태도 '처리 중'으로 함께 옮긴다(액션이 한다).
 */
export function InquiryAssignmentCard({
  inquiryId,
  assignee,
  assignedAt,
  admins,
  currentAdminId,
  canWrite,
  isLocked,
}: {
  inquiryId: string
  assignee: InquiryAdminRef | null
  assignedAt: string | null
  /** 배정 대상 후보. `/admins` 와 같은 출처라 관리자만 들어 있다. */
  admins: readonly AdminListItem[]
  currentAdminId: string
  canWrite: boolean
  /** 사용자가 접수를 취소한 문의는 읽기 전용이다(액션도 같은 규칙으로 거절한다). */
  isLocked: boolean
}) {
  const { showToast } = useToast()
  const [intent, setIntent] = useState<InquiryAssignIntent | null>(null)

  const close = useCallback(() => setIntent(null), [])

  const assign = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await assignInquiryAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        close()
      }

      return result
    },
    [close, showToast],
  )

  const unassign = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await unassignInquiryAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        close()
      }

      return result
    },
    [close, showToast],
  )

  const [assignState, assignAction, isAssigning] = useActionState(assign, EMPTY_FORM_STATE)
  const [unassignState, unassignAction, isUnassigning] = useActionState(unassign, EMPTY_FORM_STATE)

  const isMine = assignee !== null && assignee.id === currentAdminId
  const isPending = isAssigning || isUnassigning
  const formError = assignState.formError ?? unassignState.formError

  return (
    <Card>
      <CardHeader
        title="담당자"
        description="여러 운영자가 같은 문의에 답하지 않도록 맡은 사람을 먼저 정합니다."
      />
      <CardBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2" data-testid="inquiry-assignee">
          {assignee === null ? (
            <Badge tone="warn">미배정</Badge>
          ) : (
            <>
              <Badge tone={isMine ? 'accent' : 'neutral'}>{assignee.nickname}</Badge>
              {isMine && <span className="text-muted text-[12px]">내가 담당</span>}
              {assignedAt !== null && (
                <span className="text-muted text-[12px]">{formatDateTime(assignedAt)} 배정</span>
              )}
            </>
          )}
        </div>

        <FormBanner message={formError} />

        {canWrite && !isLocked && (
          <InquiryAssignmentControls
            inquiryId={inquiryId}
            assignee={assignee}
            admins={admins}
            currentAdminId={currentAdminId}
            isPending={isPending}
            assignAction={assignAction}
            unassignAction={unassignAction}
            onConfirm={setIntent}
          />
        )}
      </CardBody>

      <Dialog
        open={intent !== null}
        onClose={close}
        title={intent?.title ?? ''}
        description={intent?.description ?? ''}
      >
        <form
          action={intent?.kind === 'unassign' ? unassignAction : assignAction}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="inquiryId" value={inquiryId} />
          {intent?.kind === 'assign' && (
            <input type="hidden" name="assigneeId" value={intent.assigneeId} />
          )}

          <FormBanner message={formError} />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close} disabled={isPending}>
              취소
            </Button>
            <Button variant="danger" type="submit" disabled={isPending}>
              {isPending ? '처리 중…' : (intent?.confirmLabel ?? '확인')}
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  )
}
