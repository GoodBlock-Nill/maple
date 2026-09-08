import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SortMenu } from '@/components/board/SortMenu'
import { COMMUNITY_SORTS } from '@/lib/constants/board'

import type { ComponentProps } from 'react'

const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

// LinkMenu.test.tsx 와 동일한 대역 — 수정 키 없는 클릭에서 onNavigate 가 불린다는 계약만 재현한다.
vi.mock('next/link', () => {
  return {
    default: function LinkStub({
      href,
      onNavigate,
      children,
      ref,
      ...rest
    }: ComponentProps<'a'> & {
      href: string
      onNavigate?: (event: { preventDefault: () => void }) => void
    }) {
      return (
        <a
          href={href}
          ref={ref}
          onClick={(event) => {
            onNavigate?.({ preventDefault: () => event.preventDefault() })
          }}
          {...rest}
        >
          {children}
        </a>
      )
    },
  }
})

describe('SortMenu (community)', () => {
  it('should label the likes option as 인기순, not the old 좋아요순', () => {
    // Arrange & Act
    render(
      <SortMenu
        options={COMMUNITY_SORTS}
        active="latest"
        hrefFor={(value) => `/community?sort=${value}`}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '정렬 기준' }))

    // Assert
    expect(screen.getByRole('option', { name: '인기순' })).toBeInTheDocument()
    expect(screen.queryByText('좋아요순')).not.toBeInTheDocument()
  })

  it('should show the active option label on the trigger', () => {
    // Arrange & Act
    render(
      <SortMenu
        options={COMMUNITY_SORTS}
        active="likes"
        hrefFor={(value) => `/community?sort=${value}`}
      />,
    )

    // Assert
    expect(screen.getByRole('button', { name: '정렬 기준' })).toHaveTextContent('인기순')
  })

  it('should navigate to the URL-compatible ?sort=likes value when 인기순 is chosen', () => {
    // Arrange
    render(
      <SortMenu
        options={COMMUNITY_SORTS}
        active="latest"
        hrefFor={(value) => `/community?sort=${value}`}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '정렬 기준' }))

    // Act
    fireEvent.click(screen.getByRole('option', { name: '인기순' }))

    // Assert — URL 값은 라벨과 무관하게 하위 호환을 위해 'likes' 로 유지된다.
    expect(pushMock).toHaveBeenCalledWith('/community?sort=likes')
  })
})
