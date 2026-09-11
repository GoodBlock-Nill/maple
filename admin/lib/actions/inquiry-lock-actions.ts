'use server'

import { writeAuditLog } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/require-admin'
import { getInquiryCollabState } from '@/lib/data/inquiry-assignment'
import { createClient } from '@/lib/supabase/server'

import type { InquiryCollabState } from '@/lib/data/inquiry-assignment'

/**
 * 답변 작성 중 소프트 락 — 잡기(하트비트) · 풀기 · 현재 상태 폴링.
 *
 * 잠금은 **강제력이 없다.** 진짜로 행을 잠그면 브라우저를 닫고 간 운영자 때문에
 * 문의가 영영 열리지 않는다. 여기서 하는 일은 "지금 누가 쓰고 있다"를 알려 주는
 * 것뿐이고, 저장의 마지막 방어선은 `add_inquiry_reply()` 의 충돌 감지다.
 *
 * 폼이 아니라 **인자를 받는 액션**이다 — 하트비트와 이탈 처리는 사람이 누르는 조작이
 * 아니라 타이머·언마운트가 부르는 것이라, FormData 로 감싸면 호출부만 길어진다.
 */

export type InquiryLockResult = {
  ok: boolean
  /** ok=false 면 **다른 사람**의 살아 있는 잠금이다(배너가 이 값을 그린다). */
  editingBy: string | null
  editingNickname: string | null
  editingAt: string | null
}

function readLockResult(value: unknown): InquiryLockResult {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, editingBy: null, editingNickname: null, editingAt: null }
  }

  const record = value as Record<string, unknown>

  return {
    ok: record.ok === true,
    editingBy: typeof record.editing_by === 'string' ? record.editing_by : null,
    editingNickname: typeof record.editing_nickname === 'string' ? record.editing_nickname : null,
    editingAt: typeof record.editing_at === 'string' ? record.editing_at : null,
  }
}

/**
 * "지금부터 내가 쓴다" 선언 + 하트비트(60초마다 같은 호출).
 *
 * @param force 남이 쥔 살아 있는 잠금을 가로챈다. 이때만 감사 로그를 남긴다 —
 *   정상적인 잠금·하트비트까지 적으면 1분마다 한 줄씩 쌓여 로그가 못 쓰게 된다.
 */
export async function claimInquiryEditAction(
  inquiryId: string,
  force = false,
): Promise<InquiryLockResult> {
  const actor = await requirePermission('inquiries', 'write')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('claim_inquiry_edit', {
    p_inquiry_id: inquiryId,
    p_force: force,
  })

  if (error !== null) {
    console.error('[inquiries] 작성 잠금 실패', error.message)

    // 잠금은 편의 장치다. 실패해도 폼을 막지 않는다(충돌 감지가 마지막 방어선이다).
    return { ok: true, editingBy: actor.id, editingNickname: actor.nickname, editingAt: null }
  }

  const result = readLockResult(data)
  const takenOver =
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>).taken_over === true

  if (takenOver) {
    await writeAuditLog(actor.id, {
      action: 'inquiry.edit_lock',
      targetTable: 'inquiries',
      targetId: inquiryId,
      before: { editing_by: result.editingBy },
      after: { editing_by: actor.id, forced: true },
    })
  }

  return result
}

/** 폼을 떠날 때 내 잠금만 푼다. 실패는 조용히 넘긴다 — 5분 뒤 어차피 만료된다. */
export async function releaseInquiryEditAction(inquiryId: string): Promise<void> {
  await requirePermission('inquiries', 'write')
  const supabase = await createClient()
  const { error } = await supabase.rpc('release_inquiry_edit', { p_inquiry_id: inquiryId })

  if (error !== null) {
    console.error('[inquiries] 작성 잠금 해제 실패', error.message)
  }
}

/** 20초마다 부르는 폴링. 답변 초안을 잃지 않으려고 화면 전체를 새로 그리지 않는다. */
export async function readInquiryCollabAction(
  inquiryId: string,
): Promise<InquiryCollabState | null> {
  await requirePermission('inquiries', 'read')

  return getInquiryCollabState(inquiryId)
}
