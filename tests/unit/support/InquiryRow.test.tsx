import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { InquiryRow } from '@/components/support/InquiryRow'

import type { InquirySummary } from '@/types/domain'

/**
 * 내 문의 내역의 한 줄.
 *
 * 목록은 세 창구(1:1 문의 · 버그제보 · 불법이용제보)를 필터 없이 함께 보여 준다.
 * 그래서 행마다 **종류**가 먼저 읽혀야 한다 — 이 파일이 지키는 것은 그 한 가지다.
 */

const BASE: InquirySummary = {
  id: '33333333-0000-4000-8000-000000000001',
  inquiryNo: 1024,
  title: '로그인이 되지 않습니다',
  kind: 'inquiry',
  category: '재화·아이템',
  type: '아이템 미지급/소실',
  status: 'pending',
  cancelledAt: null,
  createdAt: '2026-09-08T01:00:00.000Z',
  replyCount: 0,
}

function rowLink(): HTMLElement {
  return screen.getByRole('link')
}

describe('InquiryRow 종류 라벨', () => {
  it('should show the kind before the category and type', () => {
    // Arrange & Act
    render(<InquiryRow inquiry={{ ...BASE, kind: 'bug', category: '접속·서버' }} />)

    // Assert — 종류 → 카테고리 → 유형 순서가 상세 메타와 같다.
    const text = rowLink().textContent ?? ''

    expect(text.indexOf('버그제보')).toBeGreaterThanOrEqual(0)
    expect(text.indexOf('버그제보')).toBeLessThan(text.indexOf('접속·서버'))
  })

  it('should label each kind with its Korean name', () => {
    // Arrange & Act & Assert
    const { rerender } = render(<InquiryRow inquiry={BASE} />)

    expect(within(rowLink()).getByText('1:1 문의')).toBeInTheDocument()

    rerender(<InquiryRow inquiry={{ ...BASE, kind: 'report' }} />)
    expect(within(rowLink()).getByText('불법이용제보')).toBeInTheDocument()
  })

  it('should read the pill out as 종류 for screen readers', () => {
    /* Arrange & Act & Assert — 알약은 색과 자리로만 뜻을 전한다. 소리로 듣는
       사용자에게는 "버그제보"가 카테고리처럼 들리므로 라벨을 붙여 둔다. */
    render(<InquiryRow inquiry={{ ...BASE, kind: 'bug' }} />)

    expect(within(rowLink()).getByText('종류')).toBeInTheDocument()
  })

  it('should still show the receipt number, date and status', () => {
    // Arrange & Act — 종류가 끼면서 기존 정보가 밀려나지 않았는지 함께 본다.
    render(<InquiryRow inquiry={BASE} />)

    const row = within(rowLink())

    expect(row.getByText('No. 1024')).toBeInTheDocument()
    expect(row.getByText(/2026/u)).toBeInTheDocument()
    expect(row.getByText('접수 대기')).toBeInTheDocument()
  })
})
