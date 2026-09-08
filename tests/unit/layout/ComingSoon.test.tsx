import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ComingSoon } from '@/components/layout/ComingSoon'

describe('ComingSoon', () => {
  it('should show the "서비스 준비 중입니다" heading and the guiding body copy', () => {
    // Arrange & Act
    render(<ComingSoon variant="guide" />)

    // Assert
    expect(screen.getByRole('heading', { name: '서비스 준비 중입니다' })).toBeInTheDocument()
    expect(
      screen.getByText('더 재미있게 준비해서 곧 만나요! 오픈 소식은 뉴스에서 먼저 알려드릴게요.'),
    ).toBeInTheDocument()
  })

  it('should link "뉴스 보러가기" to /news and "홈으로" to /', () => {
    // Arrange & Act
    render(<ComingSoon variant="guide" />)

    // Assert
    expect(screen.getByRole('link', { name: '뉴스 보러가기' })).toHaveAttribute('href', '/news')
    expect(screen.getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/')
  })

  it('should render the optional since/eta line only when provided', () => {
    // Arrange & Act
    const { rerender } = render(<ComingSoon variant="guide" />)

    // Assert — 기본값은 일정 안내가 아직 없다.
    expect(screen.queryByText('9월 중 오픈 예정')).not.toBeInTheDocument()

    // Act — since 를 넘기면 노출된다.
    rerender(<ComingSoon variant="guide" since="9월 중 오픈 예정" />)

    // Assert
    expect(screen.getByText('9월 중 오픈 예정')).toBeInTheDocument()
  })
})

// PAGE_HERO 의 마스코트 좌표(guide: top 330.45·height 100.17, ranking: top
// 349.4·height 177.1)에서 계산된 lg 이상 추가 여백 — 카드가 마스코트를
// 가리지 않는지 회귀 검증한다. 좌표가 바뀌면 이 값도 같이 갱신해야 한다.
describe('ComingSoon mascot clearance offset (lg:mt-[...])', () => {
  it('should push the card below the guide mascot bottom edge (≈431px) at lg and up', () => {
    // Arrange & Act
    const { container } = render(<ComingSoon variant="guide" />)
    const card = container.firstElementChild as HTMLElement

    // Assert — 96px 여백이면 카드 상단(228+75+52+96=451)이 마스코트 하단
    // (330.45+100.17≈430.62) 보다 20px 이상 아래에서 시작한다.
    expect(card.style.getPropertyValue('--coming-soon-mascot-clearance')).toBe('96px')
    expect(card.className).toContain('lg:mt-[var(--coming-soon-mascot-clearance)]')
  })

  it('should push the card below the ranking mascot bottom edge (≈527px) at lg and up', () => {
    // Arrange & Act
    const { container } = render(<ComingSoon variant="ranking" />)
    const card = container.firstElementChild as HTMLElement

    // Assert — 86px 여백이면 카드 상단(334+75+52+86=547)이 마스코트 하단
    // (349.4+177.1≈526.5) 보다 20px 이상 아래에서 시작한다.
    expect(card.style.getPropertyValue('--coming-soon-mascot-clearance')).toBe('86px')
  })
})
