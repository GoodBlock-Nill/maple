import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 쿠폰 쓰기 액션의 가드.
 *
 * 확인하는 것은 셋이다.
 *   1. 모든 액션이 스스로 `requirePermission('coupons', 'write')` 를 부른다 —
 *      서버 액션은 UI 를 거치지 않는 직접 POST 로도 호출된다.
 *   2. 되돌릴 수 없는 조작의 규칙이 액션 안에도 있다 — 이력이 있는 쿠폰은 삭제 불가,
 *      끝난 등록은 상태 변경 불가. 다이얼로그는 편의이지 인가가 아니다.
 *   3. Supabase 원문이 화면 문구로 새지 않는다(§7.1).
 */

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const COUPON_ID = '22222222-2222-4222-8222-222222222222'
const REDEMPTION_ID = '33333333-3333-4333-8333-333333333333'
const RAW_ERROR = 'permission denied for table coupons (policy "coupons_admin_all")'

const ACTOR = {
  id: ADMIN_ID,
  email: 'admin@stub.local',
  nickname: '운영자',
  role: 'admin',
  roleKey: 'super_admin',
  roleName: '슈퍼어드민',
  permissions: { coupons: 'write' },
  isSuperAdmin: true,
}

const LEVEL_RANK: Record<string, number> = { none: 0, read: 1, write: 2 }

/** 테스트가 조절하는 현재 관리자의 권한. 기본은 쓰기. */
const grantedLevel = { coupons: 'write' }
const guardCalls: [string, string][] = []

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn(async () => ACTOR),
  requireAnyPermission: vi.fn(async () => ACTOR),
  requireSuperAdmin: vi.fn(async () => ACTOR),
  requirePermission: vi.fn(async (module: string, level: string) => {
    guardCalls.push([module, level])

    if ((LEVEL_RANK[grantedLevel.coupons] ?? 0) < (LEVEL_RANK[level] ?? 0)) {
      // requirePermission 은 redirect() 로 빠져나간다. 그것은 예외를 던지는 것과 같다.
      throw new Error('NEXT_REDIRECT')
    }

    return ACTOR
  }),
}))

const audits: { action: string; targetId?: string }[] = []

vi.mock('@/lib/audit', () => ({
  writeAuditLog: vi.fn(async (_actorId: string, entry: { action: string; targetId?: string }) => {
    audits.push({ action: entry.action, targetId: entry.targetId })
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

type Row = Record<string, unknown> | null

const db = {
  couponRow: null as Row,
  redemptionRow: null as Row,
  redemptionCount: 0,
  writeError: null as { message: string; code?: string } | null,
  countError: null as { message: string } | null,
}

const updates: { table: string; payload: Record<string, unknown> }[] = []
const deletes: string[] = []

/* 최소한의 빌더. 쓰는 메서드만 자기 자신을 돌려주고, 종단(await · maybeSingle · single)
   에서 테스트가 심어 둔 값을 낸다. */
vi.mock('@/lib/supabase/server', () => {
  function builder(table: string) {
    let operation: 'select' | 'insert' | 'update' | 'delete' = 'select'

    const chain: Record<string, unknown> = {
      select: () => chain,
      insert: () => {
        operation = 'insert'

        return chain
      },
      update: (payload: Record<string, unknown>) => {
        operation = 'update'
        updates.push({ table, payload })

        return chain
      },
      delete: () => {
        operation = 'delete'
        deletes.push(table)

        return chain
      },
      eq: () => chain,
      maybeSingle: async () => ({
        data: table === 'coupons' ? db.couponRow : db.redemptionRow,
        error: null,
      }),
      single: async () => ({ data: { id: COUPON_ID }, error: db.writeError }),
      then: (resolve: (value: unknown) => unknown) => {
        if (operation === 'select') {
          return resolve({ data: [], count: db.redemptionCount, error: db.countError })
        }

        return resolve({ data: null, count: null, error: db.writeError })
      },
    }

    return chain
  }

  return { createClient: async () => ({ from: (table: string) => builder(table) }) }
})

const { updateCouponAction } = await import('@/lib/actions/coupons-actions')
const { deleteCouponAction, setCouponActiveAction } =
  await import('@/lib/actions/coupon-lifecycle-actions')
const { updateRedemptionStatusAction } = await import('@/lib/actions/coupon-redemption-actions')

function formData(fields: Record<string, string>): FormData {
  const data = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value)
  }

  return data
}

let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  grantedLevel.coupons = 'write'
  guardCalls.length = 0
  audits.length = 0
  updates.length = 0
  deletes.length = 0
  db.couponRow = { code: 'GLZA-TEST-0001', name: '테스트 쿠폰', is_active: true }
  db.redemptionRow = {
    coupon_id: COUPON_ID,
    status: 'pending',
    nickname_snapshot: '모험가',
    msw_uid: '20123456789000000',
  }
  db.redemptionCount = 0
  db.writeError = null
  db.countError = null
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  errorSpy.mockRestore()
})

describe('권한 가드', () => {
  it('should ask for coupons:write in every write action', async () => {
    await setCouponActiveAction({}, formData({ couponId: COUPON_ID, isActive: 'false' }))
    await deleteCouponAction({}, formData({ couponId: COUPON_ID }))
    await updateRedemptionStatusAction(
      {},
      formData({ redemptionId: REDEMPTION_ID, status: 'delivered', note: '' }),
    )

    expect(guardCalls).toEqual([
      ['coupons', 'write'],
      ['coupons', 'write'],
      ['coupons', 'write'],
    ])
  })

  it('should stop a read-only admin before touching the database', async () => {
    grantedLevel.coupons = 'read'

    await expect(
      setCouponActiveAction({}, formData({ couponId: COUPON_ID, isActive: 'false' })),
    ).rejects.toThrow('NEXT_REDIRECT')
    expect(updates).toHaveLength(0)
  })
})

describe('setCouponActiveAction', () => {
  it('should deactivate and log coupon.deactivate', async () => {
    const result = await setCouponActiveAction(
      {},
      formData({ couponId: COUPON_ID, isActive: 'false' }),
    )

    expect(result.message).toBe("쿠폰 'GLZA-TEST-0001'을 비활성화했습니다.")
    expect(updates[0]?.payload).toEqual({ is_active: false })
    expect(audits).toEqual([{ action: 'coupon.deactivate', targetId: COUPON_ID }])
  })

  it('should log coupon.activate on the way back', async () => {
    db.couponRow = { code: 'GLZA-TEST-0001', name: '테스트 쿠폰', is_active: false }

    const result = await setCouponActiveAction(
      {},
      formData({ couponId: COUPON_ID, isActive: 'true' }),
    )

    expect(result.message).toBe("쿠폰 'GLZA-TEST-0001'을 활성화했습니다.")
    expect(audits).toEqual([{ action: 'coupon.activate', targetId: COUPON_ID }])
  })

  it('should refuse a no-op instead of writing the same value again', async () => {
    const result = await setCouponActiveAction(
      {},
      formData({ couponId: COUPON_ID, isActive: 'true' }),
    )

    expect(result.formError).toBe('이미 같은 상태입니다. 쿠폰은 바뀌지 않았습니다.')
    expect(updates).toHaveLength(0)
  })

  it('should keep the raw postgres message out of the banner', async () => {
    db.writeError = { message: RAW_ERROR, code: '42501' }

    const result = await setCouponActiveAction(
      {},
      formData({ couponId: COUPON_ID, isActive: 'false' }),
    )

    expect(result.formError).toBe(
      '쿠폰을 비활성화하지 못했습니다. 상태는 그대로입니다. 목록을 새로고침한 뒤 다시 시도해 주세요.',
    )
    expect(result.formError).not.toContain('policy')
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[coupons]'), RAW_ERROR)
  })
})

describe('deleteCouponAction', () => {
  it('should delete a coupon that has no redemption', async () => {
    const result = await deleteCouponAction({}, formData({ couponId: COUPON_ID }))

    expect(result.message).toBe("쿠폰 'GLZA-TEST-0001'을 삭제했습니다.")
    expect(deletes).toEqual(['coupons'])
    expect(audits).toEqual([{ action: 'coupon.delete', targetId: COUPON_ID }])
  })

  it('should refuse once a single redemption exists', async () => {
    db.redemptionCount = 2

    const result = await deleteCouponAction({}, formData({ couponId: COUPON_ID }))

    expect(result.formError).toBe(
      '등록 내역이 2건 있어 삭제할 수 없습니다. 더 쓰지 않으려면 비활성화해 주세요.',
    )
    expect(deletes).toHaveLength(0)
  })

  it('should stop when the count itself fails rather than deleting blindly', async () => {
    db.countError = { message: RAW_ERROR }

    const result = await deleteCouponAction({}, formData({ couponId: COUPON_ID }))

    expect(result.formError).toBe(
      '등록 건수를 확인하지 못해 삭제를 멈췄습니다. 쿠폰은 그대로입니다. 잠시 후 다시 시도해 주세요.',
    )
    expect(deletes).toHaveLength(0)
  })

  it('should reject an id that is not a uuid', async () => {
    const result = await deleteCouponAction({}, formData({ couponId: 'nope' }))

    expect(result.formError).toBe('쿠폰을 찾을 수 없습니다.')
    expect(deletes).toHaveLength(0)
  })
})

describe('updateCouponAction', () => {
  it('should translate a unique violation into a field error', async () => {
    db.writeError = { message: 'duplicate key value violates unique constraint', code: '23505' }

    const result = await updateCouponAction(
      {},
      formData({
        couponId: COUPON_ID,
        code: 'GLZA-TEST-0001',
        name: '테스트 쿠폰',
        description: '',
        rewardNote: '',
        startsAt: '',
        endsAt: '',
        maxRedemptions: '',
        perUserLimit: '1',
      }),
    )

    expect(result.fieldErrors?.code).toBe(
      '이미 사용 중인 쿠폰 코드입니다. 코드를 바꾸거나 자동 생성을 눌러 주세요.',
    )
  })
})

describe('updateRedemptionStatusAction', () => {
  it('should move a pending redemption to delivered', async () => {
    const result = await updateRedemptionStatusAction(
      {},
      formData({ redemptionId: REDEMPTION_ID, status: 'delivered', note: '9월 10일 일괄 지급' }),
    )

    expect(result.message).toBe("모험가 님의 등록을 '지급 완료'로 처리했습니다.")
    expect(updates[0]?.payload).toMatchObject({
      status: 'delivered',
      admin_note: '9월 10일 일괄 지급',
      processed_by: ADMIN_ID,
    })
    expect(audits).toEqual([{ action: 'coupon_redemption.status', targetId: REDEMPTION_ID }])
  })

  it('should refuse to touch a redemption that is already finished', async () => {
    db.redemptionRow = { ...db.redemptionRow, status: 'delivered' }

    const result = await updateRedemptionStatusAction(
      {},
      formData({ redemptionId: REDEMPTION_ID, status: 'rejected', note: '' }),
    )

    expect(result.formError).toBe(
      '지급 완료 상태에서는 거절로 바꿀 수 없습니다. 이미 처리된 건입니다.',
    )
    expect(updates).toHaveLength(0)
  })

  it('should refuse a status the schema does not offer', async () => {
    const result = await updateRedemptionStatusAction(
      {},
      formData({ redemptionId: REDEMPTION_ID, status: 'pending', note: '' }),
    )

    expect(result.formError).toBeDefined()
    expect(updates).toHaveLength(0)
  })

  it('should put a too long note next to the field, not in the banner', async () => {
    const result = await updateRedemptionStatusAction(
      {},
      formData({
        redemptionId: REDEMPTION_ID,
        status: 'rejected',
        note: '가'.repeat(301),
      }),
    )

    expect(result.fieldErrors?.note).toBe('메모는 300자를 넘을 수 없습니다.')
    expect(result.formError).toBeUndefined()
  })

  it('should keep the raw postgres message out of the banner', async () => {
    db.writeError = { message: RAW_ERROR, code: '42501' }

    const result = await updateRedemptionStatusAction(
      {},
      formData({ redemptionId: REDEMPTION_ID, status: 'delivered', note: '' }),
    )

    expect(result.formError).toBe(
      '상태를 바꾸지 못했습니다. 등록 내역은 그대로입니다. 목록을 새로고침한 뒤 다시 시도해 주세요.',
    )
    expect(result.formError).not.toContain('policy')
  })
})
