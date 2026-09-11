'use client'

import { useState } from 'react'

import { Button } from '@/components/ui'

import type { AdminListItem } from '@/lib/data/admins'
import type { InquiryAdminRef } from '@/lib/data/inquiries'

/**
 * 담당자 카드의 버튼들.
 *
 * 확인이 필요한 조작은 **폼을 만들지 않고** 상위에 의도만 올려 보낸다(`onConfirm`).
 * 폼에 `onSubmit` 으로 끼어들어 `preventDefault()` 하는 방식은, 확인 창을 닫은 뒤
 * 다시 누를 때 서버 액션이 이미 예약돼 있는지 아닌지가 눈에 보이지 않는다.
 *
 * 확인이 필요 없는 조작(미배정 문의를 맡기 · 내 배정 풀기)은 그대로 폼 제출이다 —
 * 자바스크립트가 아직 안 붙었어도 동작한다.
 */
export type InquiryAssignIntent =
  | { kind: 'assign'; assigneeId: string; title: string; description: string; confirmLabel: string }
  | { kind: 'unassign'; title: string; description: string; confirmLabel: string }

export function InquiryAssignmentControls({
  inquiryId,
  assignee,
  admins,
  currentAdminId,
  isPending,
  assignAction,
  unassignAction,
  onConfirm,
}: {
  inquiryId: string
  assignee: InquiryAdminRef | null
  admins: readonly AdminListItem[]
  currentAdminId: string
  isPending: boolean
  assignAction: (formData: FormData) => void
  unassignAction: (formData: FormData) => void
  onConfirm: (intent: InquiryAssignIntent) => void
}) {
  const [selectedId, setSelectedId] = useState(assignee?.id ?? currentAdminId)
  /** 남이 맡고 있는 문의인가. 여기서만 확인 창이 필요하다. */
  const heldByOther = assignee !== null && assignee.id !== currentAdminId
  const isMine = assignee !== null && assignee.id === currentAdminId

  return (
    <div className="flex flex-wrap items-end gap-2">
      {!isMine &&
        (heldByOther ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={isPending}
            onClick={() =>
              onConfirm({
                kind: 'assign',
                assigneeId: currentAdminId,
                title: '담당자 가져오기',
                description: `${assignee.nickname} 관리자가 맡고 있는 문의입니다. 담당자를 나로 바꾸면 상대의 화면에도 그대로 보이고, 이미 쓰고 있던 답변이 사라지지는 않습니다.`,
                confirmLabel: '내가 담당',
              })
            }
          >
            나에게 배정
          </Button>
        ) : (
          <form action={assignAction}>
            <input type="hidden" name="inquiryId" value={inquiryId} />
            <input type="hidden" name="assigneeId" value={currentAdminId} />
            <Button type="submit" size="sm" disabled={isPending}>
              나에게 배정
            </Button>
          </form>
        ))}

      <label className="flex flex-col gap-1.5">
        <span className="text-ink text-[13px] font-semibold">담당자 변경</span>
        <span className="flex items-center gap-2">
          <select
            name="assigneeId"
            value={selectedId}
            disabled={isPending}
            onChange={(event) => setSelectedId(event.target.value)}
            aria-label="담당자 선택"
            className="rounded-panel border-line bg-surface text-ink focus:border-accent focus:outline-accent/40 h-9 border px-3 text-[13px] focus:outline-2"
          >
            {admins.map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.nickname}
                {admin.id === currentAdminId ? ' (나)' : ''}
              </option>
            ))}
          </select>

          {heldByOther ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={isPending}
              onClick={() =>
                onConfirm({
                  kind: 'assign',
                  assigneeId: selectedId,
                  title: '담당자 변경',
                  description: `${assignee.nickname} 관리자가 맡고 있는 문의입니다. 담당자를 바꿔도 지금까지의 답변과 메모는 그대로 남습니다.`,
                  confirmLabel: '담당자 변경',
                })
              }
            >
              변경
            </Button>
          ) : (
            <form action={assignAction}>
              <input type="hidden" name="inquiryId" value={inquiryId} />
              <input type="hidden" name="assigneeId" value={selectedId} />
              <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
                변경
              </Button>
            </form>
          )}
        </span>
      </label>

      {assignee !== null &&
        (heldByOther ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() =>
              onConfirm({
                kind: 'unassign',
                title: '배정 해제',
                description: `${assignee.nickname} 관리자의 배정을 해제합니다. 문의는 '미배정'으로 돌아가고 상태와 답변은 그대로입니다.`,
                confirmLabel: '배정 해제',
              })
            }
          >
            배정 해제
          </Button>
        ) : (
          <form action={unassignAction}>
            <input type="hidden" name="inquiryId" value={inquiryId} />
            <Button type="submit" variant="ghost" size="sm" disabled={isPending}>
              배정 해제
            </Button>
          </form>
        ))}
    </div>
  )
}
