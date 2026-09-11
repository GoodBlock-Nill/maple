import 'server-only'

import { revalidatePath } from 'next/cache'

import { logFailure } from '@/lib/actions/action-failure'
import { writeAuditLog } from '@/lib/audit'
import { createClient } from '@/lib/supabase/server'
import { josa } from '@/lib/utils/josa'
import {
  INQUIRY_STATUS_LABELS,
  canTransitionInquiryStatus,
  isCancelledInquiry,
  toInquirySource,
  type InquirySource,
  type InquiryStatus,
} from '@/lib/validation/inquiries'
import { INQUIRY_CONFLICT_MESSAGE, type InquirySnapshot } from '@/lib/validation/inquiry-assignment'

/**
 * 문의 쓰기 액션들이 함께 쓰는 조회 · 가드 · 상태 전이.
 *
 * **`'use server'` 를 붙이지 않는다.** 그 지시어가 붙은 모듈의 export 는 전부
 * 서버 액션(= 클라이언트가 직접 부를 수 있는 엔드포인트)이 된다. 여기 있는 것들은
 * 액션이 아니라 액션의 재료다.
 *
 * 답변(`inquiries-actions.ts`)과 협업(`inquiry-assignment-actions.ts`)이 같은 표를
 * 봐야 "배정으로 옮긴 처리 중"과 "상태 select 로 옮긴 처리 중"이 다른 규칙을 타지 않는다.
 */

export const INQUIRY_LIST_PATH = '/inquiries'

export const INQUIRY_NOT_FOUND_MESSAGE = '문의를 찾을 수 없습니다.'

export function inquiryDetailPath(inquiryId: string): string {
  return `${INQUIRY_LIST_PATH}/${inquiryId}`
}

/** 상세와 목록을 함께 되살린다. 담당자·상태는 두 화면에 동시에 보이는 값이다. */
export function revalidateInquiry(inquiryId: string): void {
  revalidatePath(inquiryDetailPath(inquiryId))
  revalidatePath(INQUIRY_LIST_PATH)
}

export type InquiryState = {
  status: InquiryStatus
  /** 사용자가 접수를 취소한 시각. 있으면 운영자 조작을 모두 막는다. */
  cancelledAt: string | null
  /** 답변을 메일로도 보내야 하는지 가른다(`email`). 화면 값이 아니라 DB 를 다시 읽는다. */
  source: InquirySource
  /** 담당 운영자. 배정 액션이 "이미 같은 담당자"·"가로채기"를 가른다. */
  assignedTo: string | null
}

export async function readInquiryState(inquiryId: string): Promise<InquiryState | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('inquiries')
    .select('status, cancelled_at, source, assigned_to')
    .eq('id', inquiryId)
    .maybeSingle()

  if (data === null) {
    return null
  }

  return {
    status: data.status,
    cancelledAt: data.cancelled_at,
    source: toInquirySource(data.source),
    assignedTo: data.assigned_to,
  }
}

/**
 * 사용자가 취소한 문의는 읽기 전용이다.
 *
 * 취소된 접수에 답변이 붙거나 상태가 되살아나면, 사용자 화면에는 "취소했는데 처리
 * 중"인 문의가 남는다. 화면에서도 잠그지만 액션이 마지막 방어선이다.
 */
export function cancelledGuard(state: InquiryState): string | null {
  return isCancelledInquiry(state.cancelledAt)
    ? '사용자가 접수를 취소한 문의입니다. 상태 변경과 답변 등록을 할 수 없습니다.'
    : null
}

/**
 * 상태 전이 1건. 성공하면 null, 실패하면 사용자에게 보여 줄 문구를 돌려준다.
 *
 * `answered_at` 은 처음 답변 완료로 넘어간 시각만 남긴다. 다시 답변 완료가 될 때마다
 * 갱신하면 "첫 응답까지 걸린 시간"을 나중에 계산할 수 없다.
 */
export async function applyStatusChange(
  actorId: string,
  inquiryId: string,
  from: InquiryStatus,
  to: InquiryStatus,
): Promise<string | null> {
  if (!canTransitionInquiryStatus(from, to)) {
    return `${INQUIRY_STATUS_LABELS[from]} 상태에서는 ${INQUIRY_STATUS_LABELS[to]}${josa(INQUIRY_STATUS_LABELS[to], '로')} 바꿀 수 없습니다.`
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('inquiries')
    .update({
      status: to,
      ...(to === 'answered' ? { answered_at: new Date().toISOString() } : {}),
    })
    .eq('id', inquiryId)
    .eq('status', from)

  if (error !== null) {
    return logFailure(
      'inquiries',
      '상태를 바꾸지 못했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actorId, {
    action: 'inquiry.status',
    targetTable: 'inquiries',
    targetId: inquiryId,
    before: { status: from },
    after: { status: to },
  })

  return null
}

/**
 * 화면을 연 시점과 지금이 같은가.
 *
 * 답변 등록은 DB 함수(`add_inquiry_reply`)가 같은 트랜잭션에서 다시 비교한다 —
 * 여기서 보는 것은 **상태 변경**처럼 함수를 거치지 않는 조작을 위한 것이다.
 * 스냅샷이 비어 있으면(직접 POST · 옛 탭) 검사를 건너뛴다.
 */
export function snapshotConflict(
  snapshot: InquirySnapshot,
  current: { status: InquiryStatus; replyCount: number },
): string | null {
  const statusChanged = snapshot.status !== null && snapshot.status !== current.status
  const repliesChanged = snapshot.replyCount !== null && snapshot.replyCount !== current.replyCount

  return statusChanged || repliesChanged ? INQUIRY_CONFLICT_MESSAGE : null
}

/** 지금 스레드에 달린 답변 수. 충돌 비교에만 쓰므로 행은 가져오지 않는다. */
export async function countInquiryReplies(inquiryId: string): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('inquiry_replies')
    .select('id', { count: 'exact', head: true })
    .eq('inquiry_id', inquiryId)

  return count ?? 0
}
