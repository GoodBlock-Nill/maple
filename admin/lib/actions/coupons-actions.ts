'use server'

import { actionFailure } from '@/lib/actions/action-failure'
import {
  DUPLICATE_CODE_MESSAGE,
  UNIQUE_VIOLATION,
  revalidateCoupon,
} from '@/lib/actions/coupon-shared'
import { readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import { writeAuditLog } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'
import { josa } from '@/lib/utils/josa'
import { couponSchema } from '@/lib/validation/coupons'

/**
 * 쿠폰 등록 · 수정.
 *
 * 두 액션 모두 스스로 `requirePermission('coupons', 'write')` 을 부른다. 레이아웃이 이미
 * 막고 있어도 서버 액션은 UI 를 거치지 않는 직접 POST 로 호출될 수 있다.
 *
 * 활성 토글과 삭제는 `coupon-lifecycle-actions.ts` 에 있다 — 되돌리기 어려운 조작만
 * 모아 두면 확인 다이얼로그가 필요한 자리가 한눈에 보인다(파일 300줄 상한도 함께 지킨다).
 */

/** 폼 → 스키마 입력. 체크박스는 값이 없으면 아예 오지 않는다. */
function readCouponInput(formData: FormData) {
  return {
    code: readField(formData, 'code'),
    name: readField(formData, 'name'),
    description: readField(formData, 'description'),
    rewardNote: readField(formData, 'rewardNote'),
    startsAt: readField(formData, 'startsAt'),
    endsAt: readField(formData, 'endsAt'),
    maxRedemptions: readField(formData, 'maxRedemptions'),
    perUserLimit: readField(formData, 'perUserLimit'),
    isActive: formData.get('isActive') !== null,
  }
}

/** DB 컬럼 이름으로 옮긴 저장 payload. 등록과 수정이 같은 모양을 써야 감사 로그가 맞물린다. */
function toRow(input: ReturnType<typeof couponSchema.parse>) {
  return {
    code: input.code,
    name: input.name,
    description: input.description,
    reward_note: input.rewardNote,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    max_redemptions: input.maxRedemptions,
    per_user_limit: input.perUserLimit,
    is_active: input.isActive,
  }
}

export async function createCouponAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('coupons', 'write')
  const parsed = couponSchema.safeParse(readCouponInput(formData))

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const row = toRow(parsed.data)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('coupons')
    .insert({ ...row, created_by: actor.id })
    .select('id')
    .single()

  if (error !== null) {
    if (error.code === UNIQUE_VIOLATION) {
      return { fieldErrors: { code: DUPLICATE_CODE_MESSAGE } }
    }

    return actionFailure(
      'coupons',
      '쿠폰을 만들지 못했습니다. 아무 쿠폰도 만들어지지 않았습니다. 잠시 후 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'coupon.create',
    targetTable: 'coupons',
    targetId: data.id,
    after: row,
  })

  revalidateCoupon()

  return { message: `쿠폰 '${row.code}'${josa(row.code, '을')} 만들었습니다.` }
}

export async function updateCouponAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('coupons', 'write')
  const couponId = readField(formData, 'couponId')
  const parsed = couponSchema.safeParse(readCouponInput(formData))

  if (couponId === '') {
    return { formError: '쿠폰을 찾을 수 없습니다.' }
  }

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const row = toRow(parsed.data)
  const supabase = await createClient()
  const { data: before } = await supabase
    .from('coupons')
    .select(
      'code, name, description, reward_note, starts_at, ends_at, max_redemptions, per_user_limit, is_active',
    )
    .eq('id', couponId)
    .maybeSingle()

  if (before === null) {
    return { formError: '쿠폰을 찾을 수 없습니다.' }
  }

  const { error } = await supabase.from('coupons').update(row).eq('id', couponId)

  if (error !== null) {
    if (error.code === UNIQUE_VIOLATION) {
      return { fieldErrors: { code: DUPLICATE_CODE_MESSAGE } }
    }

    return actionFailure(
      'coupons',
      '쿠폰을 수정하지 못했습니다. 값은 그대로입니다. 잠시 후 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'coupon.update',
    targetTable: 'coupons',
    targetId: couponId,
    before,
    after: row,
  })

  revalidateCoupon(couponId)

  return { message: '쿠폰을 수정했습니다.' }
}
