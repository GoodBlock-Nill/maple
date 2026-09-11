import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { InquiryPagination } from '@/components/support/InquiryPagination'

/**
 * 내 문의 내역의 번호 페이지네이션(시안 v2 pc-1 / m-1).
 *
 * 누적 "더보기"를 대체한 컨트롤이라, "지금 몇 페이지인가"와 "어디로 갈 수 있는가"가
 * 링크로 드러나야 한다 — 스크롤 위치가 아니라 주소가 상태를 들고 있다.
 */
describe('InquiryPagination', () => {
  it('should draw nothing when a single page holds everything', () => {
    // Arrange & Act — 누를 곳이 없는 컨트롤은 자리만 차지한다.
    const { container } = render(<InquiryPagination page={1} totalPages={1} />)

    // Assert
    expect(container).toBeEmptyDOMElement()
  })

  it('should mark the current page instead of linking to it', () => {
    // Arrange & Act
    render(<InquiryPagination page={2} totalPages={5} />)

    // Assert — 현재 페이지는 링크가 아니다(같은 화면으로 가는 링크는 길이 아니다).
    expect(screen.getByText('2')).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('link', { name: '2 페이지' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '3 페이지' })).toHaveAttribute(
      'href',
      '/support/inquiries?page=3',
    )
  })

  it('should drop the page query on the way back to the first page', () => {
    // Arrange & Act — `?page=1` 과 `/support/inquiries` 가 같은 링크로 정규화된다.
    render(<InquiryPagination page={2} totalPages={5} />)

    // Assert
    expect(screen.getByRole('link', { name: '이전 페이지' })).toHaveAttribute(
      'href',
      '/support/inquiries',
    )
  })

  it('should disable the arrows at both ends', () => {
    // Arrange & Act
    const { unmount } = render(<InquiryPagination page={1} totalPages={3} />)

    // Assert
    expect(screen.queryByRole('link', { name: '이전 페이지' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '다음 페이지' })).toBeInTheDocument()

    unmount()
    render(<InquiryPagination page={3} totalPages={3} />)

    expect(screen.getByRole('link', { name: '이전 페이지' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '다음 페이지' })).not.toBeInTheDocument()
  })

  it('should slide a five-wide window around the current page', () => {
    // Arrange & Act — 창이 움직이지 않으면 6페이지째부터 현재 페이지가 사라진다.
    render(<InquiryPagination page={7} totalPages={12} />)

    // Assert
    const numbers = screen.getAllByRole('listitem').map((item) => item.textContent)

    expect(numbers).toEqual(['5', '6', '7', '8', '9'])
  })
})
