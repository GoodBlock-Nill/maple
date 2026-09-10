'use server'

import { revalidatePath } from 'next/cache'

import { actionFailure } from '@/lib/actions/action-failure'
import { readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import { writeAuditLog } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'
import { josa } from '@/lib/utils/josa'
import {
  COUPON_REDEMPTION_STATUS_LABELS,
  canTransitionRedemptionStatus,
  couponRedemptionStatusSchema,
  isCouponRedemptionStatus,
  type CouponRedemptionStatus,
} from '@/lib/validation/coupon-redemptions'

/**
 * 쿠폰 등록 내역의 상태 처리 — 지급 완료 · 거절.
 *
 * 실제 지급은 게임 안에서 사람이 한다. 이 액션이 하는 일은 "게임팀이 처리했다"는
 * 사실과 그 근거(처리자 · 시각 · 메모)를 남기는 것뿐이다.
 *
 * 전이 판정은 화면과 **같은 표**(`COUPON_REDEMPTION_TRANSITIONS`)를 본다. 끝난 건을
 * 되돌리는 길은 없다 — 지급을 취소하려면 게임 안에서 회수해야 하는데 콘솔에는 그
 * 수단이 없고, 상태만 되돌리면 같은 사람에게 두 번 지급된다.
 *
 * `.eq('status', from)` 을 update 조건에 함께 넣는다. 두 운영자가 같은 건을 동시에
 * 눌러도 나중 한 명은 0행을 고치고 "이미 처리됨"을 보게 된다(낙관적 잠금).
 */

const LIST_PATH = '/coupons'

export async function updateRedemptionStatusAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('coupons', 'write')
  const parsed = couponRedemptionStatusSchema.safeParse({
    redemptionId: readField(formData, 'redemptionId'),
    status: readField(formData, 'status'),
    note: readField(formData, 'note'),
  })

  if (!parsed.success) {
    const fieldErrors = toFieldErrors(parsed.error)

    // 메모만 잘못됐다면 입력 옆에 붙인다. 나머지는 폼 상단 배너로 올린다.
    return fieldErrors.note === undefined
      ? { formError: Object.values(fieldErrors)[0] ?? '잘못된 요청입니다.' }
      : { fieldErrors }
  }

  const { redemptionId, status, note } = parsed.data
  const supabase = await createClient()
  const { data: before } = await supabase
    .from('coupon_redemptions')
    .select('coupon_id, status, nickname_snapshot, msw_uid')
    .eq('id', redemptionId)
    .maybeSingle()

  if (before === null) {
    return { formError: '등록 내역을 찾을 수 없습니다.' }
  }

  if (!isCouponRedemptionStatus(before.status)) {
    return { formError: '알 수 없는 상태입니다. 목록을 새로고침해 주세요.' }
  }

  const from: CouponRedemptionStatus = before.status
  const fromLabel = COUPON_REDEMPTION_STATUS_LABELS[from]
  const toLabel = COUPON_REDEMPTION_STATUS_LABELS[status]

  if (!canTransitionRedemptionStatus(from, status)) {
    return {
      formError: `${fromLabel} 상태에서는 ${toLabel}${josa(toLabel, '로')} 바꿀 수 없습니다. 이미 처리된 건입니다.`,
    }
  }

  const processedAt = new Date().toISOString()
  const { error } = await supabase
    .from('coupon_redemptions')
    .update({
      status,
      admin_note: note,
      processed_by: actor.id,
      processed_at: processedAt,
    })
    .eq('id', redemptionId)
    .eq('status', from)

  if (error !== null) {
    return actionFailure(
      'coupons',
      '상태를 바꾸지 못했습니다. 등록 내역은 그대로입니다. 목록을 새로고침한 뒤 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'coupon_redemption.status',
    targetTable: 'coupon_redemptions',
    targetId: redemptionId,
    before: { status: from },
    after: {
      status,
      coupon_id: before.coupon_id,
      msw_uid: before.msw_uid,
      admin_note: note,
      processed_at: processedAt,
    },
  })

  revalidatePath(`${LIST_PATH}/${before.coupon_id}`)
  revalidatePath(LIST_PATH)

  const who = before.nickname_snapshot ?? before.msw_uid

  return { message: `${who} 님의 등록을 '${toLabel}'${josa(toLabel, '로')} 처리했습니다.` }
}
