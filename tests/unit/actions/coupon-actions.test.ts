import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseStub } from './supabase-stub'

import type { SupabaseStub } from './supabase-stub'

/**
 * 쿠폰 등록 액션.
 *
 * DB 함수(`redeem_coupon`)가 판정을 모두 갖고 있으므로, 여기서 재는 것은
 * "무엇이 RPC 까지 도달하는가"와 "결과 코드가 어느 자리에 어떤 문구로 앉는가"다.
 */

const REDIRECT_PREFIX = 'NEXT_REDIRECT:'

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`${REDIRECT_PREFIX}${path}`)
  },
}))

const refresh = vi.fn()
vi.mock('next/cache', () => ({ refresh: (...args: unknown[]) => refresh(...args) }))

let stub: SupabaseStub
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => stub.client }))

const { redeemCouponAction } = await import('@/lib/actions/coupon-actions')

const USER_ID = 'aaaaaaaa-0000-4000-8000-000000000001'

const VALID = {
  code: 'glza-test-0001',
  mswUid: '20123000000000000',
  mswProfileCode: 'ABCD1',
}

function form(values: Record<string, string>): FormData {
  const formData = new FormData()

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value)
  }

  return formData
}

function withResult(result: unknown): void {
  stub = createSupabaseStub([{ data: result, error: null }])
  stub.client.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
}

beforeEach(() => {
  stub = createSupabaseStub()
  stub.client.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  refresh.mockReset()
})

describe('redeemCouponAction', () => {
  it('should send an anonymous visitor to the login page', async () => {
    // Arrange
    stub.client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

    // Act
    const promise = redeemCouponAction({}, form(VALID))

    // Assert
    await expect(promise).rejects.toThrow(
      `${REDIRECT_PREFIX}/login?next=${encodeURIComponent('/account/coupon')}`,
    )
  })

  it('should reject a malformed code before calling the RPC', async () => {
    // Arrange & Act
    const result = await redeemCouponAction({}, form({ ...VALID, code: 'AB' }))

    // Assert
    expect(result.fieldErrors?.code).toBeDefined()
    expect(stub.rpcCalls).toHaveLength(0)
  })

  it('should reject a malformed MSW uid before calling the RPC', async () => {
    // Arrange & Act
    const result = await redeemCouponAction({}, form({ ...VALID, mswUid: '123' }))

    // Assert
    expect(result.fieldErrors?.mswUid).toBeDefined()
    expect(stub.rpcCalls).toHaveLength(0)
  })

  it('should send normalized values to redeem_coupon', async () => {
    // Arrange
    withResult({ ok: true, coupon_name: '테스트 쿠폰' })

    // Act
    await redeemCouponAction({}, form(VALID))

    // Assert — 코드는 대문자·공백 제거, 프로필 코드는 소문자 + "#".
    expect(stub.rpcCalls).toEqual([
      {
        name: 'redeem_coupon',
        args: {
          p_code: 'GLZA-TEST-0001',
          p_msw_uid: '20123000000000000',
          p_msw_profile_code: '#abcd1',
        },
      },
    ])
  })

  it('should report success with the coupon name and refresh the route', async () => {
    // Arrange
    withResult({ ok: true, coupon_name: '테스트 쿠폰', reward_note: '보상' })

    // Act
    const result = await redeemCouponAction({}, form(VALID))

    // Assert
    expect(result.message).toBe(
      '쿠폰이 등록되었습니다. 아래 “쿠폰 등록 내역”에서 처리 상태를 확인할 수 있습니다.',
    )
    expect(result.couponName).toBe('테스트 쿠폰')
    expect(typeof result.successAt).toBe('number')
    expect(refresh).toHaveBeenCalled()
  })

  it.each([
    ['invalid_code', 'code', '존재하지 않거나 사용할 수 없는 쿠폰 코드입니다.'],
    ['expired', 'code', '사용 기간이 지난 쿠폰입니다.'],
    ['already_redeemed', 'code', '이미 등록한 쿠폰입니다.'],
    [
      'msw_uid_taken',
      'mswUid',
      '이미 다른 계정에 연결된 월드 계정 UID입니다. 고객지원에 문의해 주세요.',
    ],
  ])('should put the %s failure on the %s field', async (code, field, message) => {
    // Arrange
    withResult({ ok: false, code })

    // Act
    const result = await redeemCouponAction({}, form(VALID))

    // Assert
    expect(result.fieldErrors?.[field]).toBe(message)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('should show account-wide failures above the form', async () => {
    // Arrange
    withResult({ ok: false, code: 'suspended' })

    // Act
    const result = await redeemCouponAction({}, form(VALID))

    // Assert
    expect(result.formError).toBe('이용이 제한된 계정은 쿠폰을 등록할 수 없습니다.')
  })

  it('should not leak a transport error message', async () => {
    // Arrange
    stub = createSupabaseStub([{ data: null, error: { message: 'permission denied for schema' } }])
    stub.client.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    // Act
    const result = await redeemCouponAction({}, form(VALID))

    // Assert
    expect(result.formError).toBe('쿠폰을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  })
})
