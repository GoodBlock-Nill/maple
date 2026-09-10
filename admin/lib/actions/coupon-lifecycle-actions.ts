'use server'

import { actionFailure } from '@/lib/actions/action-failure'
import { FOREIGN_KEY_VIOLATION, revalidateCoupon } from '@/lib/actions/coupon-shared'
import { readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import { writeAuditLog } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'
import { josa } from '@/lib/utils/josa'
import { couponActiveSchema, couponDeleteSchema } from '@/lib/validation/coupons'

/**
 * 쿠폰의 생애주기 — 활성 토글 · 삭제.
 *
 * 되돌리기 어려운 조작만 모았다. 둘 다 화면에서 확인 다이얼로그를 거치지만(§7.4),
 * 다이얼로그는 편의이지 인가가 아니다 — 규칙은 여기에도 그대로 있다.
 */

export async function setCouponActiveAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('coupons', 'write')
  const parsed = couponActiveSchema.safeParse({
    couponId: readField(formData, 'couponId'),
    isActive: readField(formData, 'isActive') === 'true',
  })

  if (!parsed.success) {
    return { formError: Object.values(toFieldErrors(parsed.error))[0] ?? '잘못된 요청입니다.' }
  }

  const { couponId, isActive } = parsed.data
  const supabase = await createClient()
  const { data: before } = await supabase
    .from('coupons')
    .select('code, is_active')
    .eq('id', couponId)
    .maybeSingle()

  if (before === null) {
    return { formError: '쿠폰을 찾을 수 없습니다.' }
  }

  if (before.is_active === isActive) {
    return { formError: '이미 같은 상태입니다. 쿠폰은 바뀌지 않았습니다.' }
  }

  /* `.eq('is_active', …)` 를 함께 건다 — 두 운영자가 동시에 눌러도 나중 한 명은 0행을
     고치고, 화면은 새로고침 뒤 실제 상태를 본다(낙관적 잠금). */
  const { error } = await supabase
    .from('coupons')
    .update({ is_active: isActive })
    .eq('id', couponId)
    .eq('is_active', before.is_active)

  if (error !== null) {
    return actionFailure(
      'coupons',
      `쿠폰을 ${isActive ? '활성화' : '비활성화'}하지 못했습니다. 상태는 그대로입니다. 목록을 새로고침한 뒤 다시 시도해 주세요.`,
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: isActive ? 'coupon.activate' : 'coupon.deactivate',
    targetTable: 'coupons',
    targetId: couponId,
    before: { is_active: before.is_active },
    after: { is_active: isActive },
  })

  revalidateCoupon(couponId)

  return {
    message: `쿠폰 '${before.code}'${josa(before.code, '을')} ${isActive ? '활성화했습니다' : '비활성화했습니다'}.`,
  }
}

/**
 * 삭제 — 등록 내역이 **한 건도 없을 때만**.
 *
 * 이력이 남은 쿠폰을 지우면 지급 대사(對査)의 근거가 끊긴다. FK 가 `on delete restrict`
 * 라 DB 도 막지만, 화면에는 제약명이 섞인 문장이 아니라 이유가 나가야 한다.
 *
 * 집계 자체가 깨지면 **삭제하지 않는다.** "0건인 줄 알았다"로 지우는 것이 가장 나쁘다.
 */
export async function deleteCouponAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('coupons', 'write')
  const parsed = couponDeleteSchema.safeParse({ couponId: readField(formData, 'couponId') })

  if (!parsed.success) {
    return { formError: '쿠폰을 찾을 수 없습니다.' }
  }

  const { couponId } = parsed.data
  const supabase = await createClient()
  const [{ data: before }, { count, error: countError }] = await Promise.all([
    supabase.from('coupons').select('code, name').eq('id', couponId).maybeSingle(),
    supabase
      .from('coupon_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', couponId),
  ])

  if (before === null) {
    return { formError: '쿠폰을 찾을 수 없습니다.' }
  }

  if (countError !== null) {
    return actionFailure(
      'coupons',
      '등록 건수를 확인하지 못해 삭제를 멈췄습니다. 쿠폰은 그대로입니다. 잠시 후 다시 시도해 주세요.',
      countError,
    )
  }

  if ((count ?? 0) > 0) {
    return {
      formError: `등록 내역이 ${count}건 있어 삭제할 수 없습니다. 더 쓰지 않으려면 비활성화해 주세요.`,
    }
  }

  const { error } = await supabase.from('coupons').delete().eq('id', couponId)

  if (error !== null) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return {
        formError:
          '방금 등록된 내역이 있어 삭제할 수 없습니다. 쿠폰은 그대로입니다. 비활성화를 이용해 주세요.',
      }
    }

    return actionFailure(
      'coupons',
      '쿠폰을 삭제하지 못했습니다. 쿠폰은 그대로입니다. 목록을 새로고침한 뒤 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'coupon.delete',
    targetTable: 'coupons',
    targetId: couponId,
    before,
  })

  revalidateCoupon()

  return { message: `쿠폰 '${before.code}'${josa(before.code, '을')} 삭제했습니다.` }
}
