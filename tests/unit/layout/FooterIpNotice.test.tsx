import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { FooterIpNotice } from '@/components/layout/FooterIpNotice'
import { IP_NOTICE } from '@/lib/constants/site'

describe('FooterIpNotice', () => {
  it('should render all four fallback lines as text', () => {
    // Arrange & Act
    render(<FooterIpNotice notice={IP_NOTICE} />)

    // Assert — 각 줄이 화면에 그려지는지(공백 정규화 텍스트 매처).
    expect(
      screen.getByText(/본 서버는 넥슨\(주\)의 메이플스토리월드 플랫폼에서 공식 출시된 글자월드입니다\./u),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/본 서비스는 이용약관 및 가이드라인을 준수하여 운영됩니다\./u),
    ).toBeInTheDocument()
  })

  it('should bold the four proper nouns and nothing else', () => {
    // Arrange & Act
    render(<FooterIpNotice notice={IP_NOTICE} />)

    // Assert
    expect(screen.getByText("'MapleStory'").tagName).toBe('SPAN')
    expect(screen.getByText("'MapleStory'")).toHaveClass('font-semibold')
    expect(screen.getByText("'MapleStory Worlds'")).toHaveClass('font-semibold')
    expect(screen.getByText('NEXON Korea Corp.')).toHaveClass('font-semibold')
    expect(screen.getByText('Toben Studio Inc.')).toHaveClass('font-semibold')
  })

  it('should render one <br> between each pair of lines', () => {
    // Arrange & Act
    const { container } = render(<FooterIpNotice notice={IP_NOTICE} />)

    // Assert — 4줄이면 <br> 3개.
    expect(container.querySelectorAll('br')).toHaveLength(3)
  })

  it('should render an empty paragraph when given an empty notice', () => {
    // Arrange & Act
    const { container } = render(<FooterIpNotice notice="" />)

    // Assert
    expect(container.querySelector('p')).toBeEmptyDOMElement()
  })
})
