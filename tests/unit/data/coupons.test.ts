import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseStub } from '../actions/supabase-stub'

import type { SupabaseStub } from '../actions/supabase-stub'

/** `server-only` 는 클라이언트 환경에서 import 되면 예외를 던진다. 테스트에서는 비운다. */
vi.mock('server-only', () => ({}))

let stub: SupabaseStub
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => stub.client }))

const { getMyCouponRedemptions, toCouponRedemption } = await import('@/lib/data/coupons')
const { COUPON_HISTORY_MAX } = await import('@/lib/constants/coupons')

/**
 * 쿠폰 등록 내역 조회.
 *
 * 관심사는 둘이다.
 *   1. **테이블이 아니라 RPC 를 부른다.** `coupons` 에는 사용자 select 정책이 없어서
 *      테이블 조회로는 쿠폰 이름도 보상 안내도 읽히지 않는다.
 *   2. 생성된 타입이 non-null 로 적어 둔 칸(reward_note · processed_at …)이 실제로는
 *      null 로 오므로, 경계에서 좁히지 않으면 화면이 터진다.
 */

const ROW = {
  id: 'c09f31cd-c7f8-49b5-b7e6-94b8762f752c',
  coupon_name: '오픈 기념 쿠폰',
  reward_note: '성장의 비약 10개',
  code_masked: '****-****-0001',
  msw_uid: '20123456789000000',
  msw_profile_code: '#abcd0',
  status: 'pending',
  admin_note: null,
  created_at: '2026-09-10T02:26:49.707914+00:00',
  processed_at: null,
}

beforeEach(() => {
  stub = createSupabaseStub([{ data: [ROW], error: null }])
})

describe('getMyCouponRedemptions', () => {
  it('should read the history through the RPC and never touch the tables', async () => {
    // Arrange & Act
    const history = await getMyCouponRedemptions()

    // Assert
    expect(stub.rpcCalls.map((call) => call.name)).toEqual(['my_coupon_redemptions'])
    expect(stub.tables).toEqual([])
    expect(history.failed).toBe(false)
    expect(history.items[0]).toMatchObject({
      id: ROW.id,
      couponName: '오픈 기념 쿠폰',
      codeMasked: '****-****-0001',
      status: 'pending',
    })
  })

  it('should report a failed read instead of an empty history', async () => {
    // Arrange — 못 읽었다고 등록 폼까지 막을 이유가 없다. 화면은 안내 한 줄만 띄운다.
    stub = createSupabaseStub([{ data: null, error: { message: 'boom' } }])

    // Act
    const history = await getMyCouponRedemptions()

    // Assert
    expect(history).toEqual({ items: [], failed: true })
  })

  it('should cap the list so one account cannot stretch the card forever', async () => {
    // Arrange
    stub = createSupabaseStub([
      { data: Array.from({ length: COUPON_HISTORY_MAX + 5 }, () => ROW), error: null },
    ])

    // Act
    const history = await getMyCouponRedemptions()

    // Assert
    expect(history.items).toHaveLength(COUPON_HISTORY_MAX)
  })
})

describe('toCouponRedemption', () => {
  it('should narrow the columns the type generator wrongly calls non-null', () => {
    // Arrange & Act
    const item = toCouponRedemption({
      ...ROW,
      coupon_name: null,
      reward_note: '   ',
      code_masked: null,
      msw_uid: null,
      msw_profile_code: null,
      processed_at: null,
    })

    // Assert — 빈칸 대신 뜻이 있는 낱말이 남는다.
    expect(item.couponName).toBe('쿠폰')
    expect(item.rewardNote).toBeNull()
    expect(item.codeMasked).toBe('-')
    expect(item.mswUid).toBe('-')
    expect(item.processedAt).toBeNull()
  })

  it('should keep the reason only on rejected rows', () => {
    // Arrange & Act — 거절이 아닌 건의 메모는 운영 기록이라 사용자에게 보이지 않는다.
    const delivered = toCouponRedemption({
      ...ROW,
      status: 'delivered',
      admin_note: '게임팀 확인 완료',
      processed_at: '2026-09-11T05:00:00.000Z',
    })
    const rejected = toCouponRedemption({
      ...ROW,
      status: 'rejected',
      admin_note: 'UID 계정을 찾을 수 없습니다.',
    })

    // Assert
    expect(delivered.adminNote).toBeNull()
    expect(delivered.processedAt).toBe('2026-09-11T05:00:00.000Z')
    expect(rejected.adminNote).toBe('UID 계정을 찾을 수 없습니다.')
  })

  it('should default an unknown status to pending', () => {
    // Arrange & Act & Assert — DB 가 상태를 늘려도 화면이 빈칸이 되지 않는다.
    expect(toCouponRedemption({ ...ROW, status: 'queued' }).status).toBe('pending')
  })
})
