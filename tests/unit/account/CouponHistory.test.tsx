import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CouponHighlightContext } from '@/components/account/coupon-highlight'
import { CouponHistory } from '@/components/account/CouponHistory'
import { COUPON_HISTORY_PAGE } from '@/lib/constants/coupons'

import type { CouponHistory as CouponHistoryModel, CouponRedemption } from '@/lib/constants/coupons'
import type { ReactElement } from 'react'

/**
 * "쿠폰 등록 내역" 카드.
 *
 * 이 카드가 답해야 하는 것은 셋이다 — (1) 방금 등록한 것이 들어갔나, (2) 언제 받나,
 * (3) 왜 못 받았나. 문구 규칙 자체는 `coupon-result.test.ts` 가 보고, 여기서는
 * "그 답이 화면에 실제로 나오는가"만 본다.
 *
 * 표(≥1024)와 카드(<1024)를 같은 데이터로 함께 그리므로 텍스트는 두 번 나온다.
 * `getAllBy…` 를 쓰는 이유이며, 개수 자체가 두 벌이 붙어 있다는 증거다.
 */

vi.mock('server-only', () => ({}))

const ID = 'c09f31cd-c7f8-49b5-b7e6-94b8762f752c'

function item(overrides: Partial<CouponRedemption> = {}): CouponRedemption {
  return {
    id: ID,
    couponName: '오픈 기념 쿠폰',
    rewardNote: '성장의 비약 10개',
    codeMasked: '****-****-0001',
    mswUid: '20123456789000000',
    mswProfileCode: '#abcd0',
    status: 'pending',
    adminNote: null,
    createdAt: '2026-09-10T02:26:49.707914+00:00',
    processedAt: null,
    ...overrides,
  }
}

function history(items: readonly CouponRedemption[], failed = false): CouponHistoryModel {
  return { items, failed }
}

/** 강조 표식은 등록 폼이 컨텍스트로 내려보낸다. */
function withHighlight(node: ReactElement, id: string | null) {
  return render(<CouponHighlightContext value={id}>{node}</CouponHighlightContext>)
}

describe('CouponHistory — 빈 목록', () => {
  it('should explain what coupons are and point back at the form', () => {
    // Arrange & Act
    render(<CouponHistory history={history([])} />)

    // Assert — 빈 표 대신 "코드는 어디서 나오는가"를 알려 준다.
    expect(screen.getByRole('heading', { name: '쿠폰 등록 내역' })).toBeInTheDocument()
    expect(screen.getByText('아직 등록한 쿠폰이 없습니다.')).toBeInTheDocument()
    expect(screen.getByText(/공지사항·이벤트·방송/u)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '쿠폰 코드 입력하기' })).toBeInTheDocument()
  })

  it('should keep the delivery notice even before the first registration', () => {
    // Arrange & Act
    render(<CouponHistory history={history([])} />)

    // Assert
    expect(screen.getByText(/보통 1~3일 걸립니다/u)).toBeInTheDocument()
  })

  it('should say the list is unavailable instead of pretending it is empty', () => {
    // Arrange & Act — 조회 실패와 "이력 없음"은 다른 상태다.
    render(<CouponHistory history={history([], true)} />)

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('지금은 등록 내역을 불러올 수 없습니다.')
    expect(screen.queryByText('아직 등록한 쿠폰이 없습니다.')).not.toBeInTheDocument()
  })
})

describe('CouponHistory — 목록', () => {
  it('should show the coupon, the masked code, the date and the status', () => {
    // Arrange & Act
    render(<CouponHistory history={history([item({ status: 'delivered' })])} />)

    // Assert — 표와 폰 카드가 같은 값을 그린다(두 벌).
    expect(screen.getAllByText('오픈 기념 쿠폰')).toHaveLength(2)
    expect(screen.getAllByText('****-****-0001')[0]).toBeInTheDocument()
    expect(screen.getAllByText(/2026-09-10/u)[0]).toBeInTheDocument()
    /* 범례에 상태 배지 세 개가 함께 서므로 '지급 완료'는 범례 1 + 표 1 + 카드 1 이다. */
    expect(screen.getAllByText('지급 완료')).toHaveLength(3)
  })

  it('should keep the reward note and the world account behind one click', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<CouponHistory history={history([item()])} />)
    const table = within(screen.getByRole('table'))

    // Assert — 접힌 상태에서는 보상 안내가 없다.
    expect(screen.queryByText('성장의 비약 10개')).not.toBeInTheDocument()

    // Act
    await user.click(table.getByRole('button', { name: /오픈 기념 쿠폰/u }))

    // Assert
    expect(table.getByText('성장의 비약 10개')).toBeInTheDocument()
    expect(table.getByText(/20123456789000000/u)).toBeInTheDocument()
    expect(table.getByText(/아직 처리 전입니다/u)).toBeInTheDocument()
  })

  it('should give a rejected row its reason and a way to ask about it', async () => {
    // Arrange
    const user = userEvent.setup()
    const rejected = item({
      status: 'rejected',
      adminNote: '입력한 UID 계정을 찾을 수 없습니다.',
      processedAt: '2026-09-11T05:00:00.000Z',
    })
    render(<CouponHistory history={history([rejected])} />)
    const table = within(screen.getByRole('table'))

    // Act
    await user.click(table.getByRole('button', { name: /오픈 기념 쿠폰/u }))

    // Assert
    expect(table.getByText(/입력한 UID 계정을 찾을 수 없습니다/u)).toBeInTheDocument()
    expect(table.getByRole('link', { name: '고객지원에 문의' })).toHaveAttribute('href', '/support')
  })

  it('should fall back to a support hint when the operator left no reason', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<CouponHistory history={history([item({ status: 'rejected' })])} />)
    const table = within(screen.getByRole('table'))

    // Act
    await user.click(table.getByRole('button', { name: /오픈 기념 쿠폰/u }))

    // Assert — 사유 없이 '거절'만 남기면 물어볼 곳이 없다.
    expect(table.getByText(/자세한 사유는 고객지원으로 문의해 주세요/u)).toBeInTheDocument()
  })

  it('should reveal the rest only when asked', async () => {
    // Arrange
    const user = userEvent.setup()
    const many = Array.from({ length: COUPON_HISTORY_PAGE + 3 }, (_, index) =>
      item({ id: `id-${index}`, couponName: `쿠폰 ${index}` }),
    )
    render(<CouponHistory history={history(many)} />)

    // Assert — 처음에는 10건.
    expect(screen.queryByText('쿠폰 10')).not.toBeInTheDocument()
    const more = screen.getByRole('button', { name: `더보기(${COUPON_HISTORY_PAGE}/13)` })

    // Act
    await user.click(more)

    // Assert
    expect(screen.getAllByText('쿠폰 12')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /더보기/u })).not.toBeInTheDocument()
  })
})

describe('CouponHistory — 방금 등록한 줄', () => {
  it('should highlight and open the row the registration just created', () => {
    // Arrange & Act
    const { container } = withHighlight(
      <CouponHistory history={history([item({ id: 'fresh' }), item({ id: 'old' })])} />,
      'fresh',
    )

    // Assert — 강조는 CSS 애니메이션 한 겹이고, 스크린 리더에는 문장으로 알린다.
    expect(container.querySelectorAll('.coupon-row-new')).toHaveLength(2)
    expect(screen.getAllByText('방금 등록한 쿠폰입니다.')).toHaveLength(2)
    /* 대기 중이라는 낱말만으로는 언제 받는지 알 수 없어서 펼친 채로 연다. */
    expect(screen.getAllByText('성장의 비약 10개')).toHaveLength(2)
  })

  it('should leave every row closed when nothing was registered', () => {
    // Arrange & Act
    const { container } = render(<CouponHistory history={history([item()])} />)

    // Assert
    expect(container.querySelector('.coupon-row-new')).toBeNull()
    expect(screen.queryByText('성장의 비약 10개')).not.toBeInTheDocument()
  })

  it('should mark the expandable row with aria-expanded', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<CouponHistory history={history([item()])} />)
    const table = screen.getByRole('table')
    const trigger = within(table).getByRole('button', { name: /오픈 기념 쿠폰/u })

    // Assert
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    // Act
    await user.click(trigger)

    // Assert
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })
})
