import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { InquiryStatusBadge } from '@/components/support/InquiryStatusBadge'

/**
 * 상태 표기(시안 v2).
 *
 * 답변 완료만 알약을 벗고 분홍 글자가 된다. 이 판정은 상태표가 들고 있으므로
 * 뱃지는 그 모양을 그대로 따라야 한다 — 화면마다 분기하면 목록과 상세가 서로
 * 다른 상태를 그린다.
 */
describe('InquiryStatusBadge', () => {
  it('should wrap a pending inquiry in the neutral pill', () => {
    // Arrange & Act
    render(<InquiryStatusBadge status="pending" />)

    // Assert
    const badge = screen.getByText('접수 대기')

    expect(badge.className).toContain('rounded-pill')
    expect(badge.className).toContain('bg-[#f1f1f5]')
  })

  it('should drop the pill once the inquiry is answered', () => {
    // Arrange & Act
    render(<InquiryStatusBadge status="answered" />)

    // Assert — 알약 없이 분홍 글자다.
    const badge = screen.getByText('답변 완료')

    expect(badge.className).not.toContain('rounded-pill')
    expect(badge.className).toContain('text-[#e8308a]')
  })

  it('should label a cancelled inquiry 접수 취소 with the neutral pill', () => {
    // Arrange & Act — 취소는 DB 에 closed 로 저장되고 cancelled_at 으로만 구분된다.
    render(<InquiryStatusBadge status="closed" cancelledAt="2026-09-11T02:00:00.000Z" />)

    // Assert
    expect(screen.getByText('접수 취소').className).toContain('rounded-pill')
    expect(screen.queryByText('종료')).not.toBeInTheDocument()
  })
})
