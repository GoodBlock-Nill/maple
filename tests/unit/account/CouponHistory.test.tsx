import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CouponHistory } from '@/components/account/CouponHistory'

import type { CouponRedemptionSummary } from '@/lib/data/coupons'

/**
 * "등록한 쿠폰" 목록.
 *
 * 쿠폰 이름·코드는 **읽히지 않을 수 있다** — `coupons` 에 일반 사용자 select 정책이
 * 없어서(코드 열거 차단) 임베드가 null 로 온다. 그 상태에서도 목록이 뜻을 잃지
 * 않는지가 이 파일의 관심사다(문구 규칙 자체는 `coupon-result.test.ts` 가 본다).
 */

function item(overrides: Partial<CouponRedemptionSummary> = {}): CouponRedemptionSummary {
  return {
    id: 'c09f31cd-c7f8-49b5-b7e6-94b8762f752c',
    couponName: null,
    couponCode: null,
    status: 'pending',
    createdAt: '2026-09-10T02:26:49.707914+00:00',
    ...overrides,
  }
}

describe('CouponHistory', () => {
  it('should render nothing when there is no history', () => {
    // Arrange & Act — 빈 표를 두면 폼 아래가 공허해지고 알려 줄 내용도 없다.
    const { container } = render(<CouponHistory items={[]} />)

    // Assert
    expect(container).toBeEmptyDOMElement()
  })

  it('should show the registration date and the status badge', () => {
    // Arrange & Act
    render(<CouponHistory items={[item({ status: 'delivered' })]} />)

    // Assert
    expect(screen.getByText('등록한 쿠폰')).toBeInTheDocument()
    expect(screen.getByText('2026-09-10')).toBeInTheDocument()
    expect(screen.getByText('지급완료')).toBeInTheDocument()
    expect(screen.getByText('쿠폰')).toBeInTheDocument()
  })

  it('should use the coupon name once the policy makes it readable', () => {
    // Arrange & Act
    render(<CouponHistory items={[item({ couponName: '연동 테스트 쿠폰' })]} />)

    // Assert
    expect(screen.getByText('연동 테스트 쿠폰')).toBeInTheDocument()
    expect(screen.getByText('대기')).toBeInTheDocument()
  })
})
