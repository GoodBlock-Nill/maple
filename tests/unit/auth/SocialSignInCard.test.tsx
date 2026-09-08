import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

/* 서버 액션 모듈은 supabase 서버 클라이언트를 끌고 오므로 jsdom 에서 그대로
   import 할 수 없다. 폼 액션은 이 테스트의 관심사가 아니라서 비워 둔다. */
vi.mock('@/lib/actions/auth-actions', () => ({
  socialSignIn: async () => ({}),
}))

const { SocialSignInCard } = await import('@/components/auth/SocialSignInCard')

describe('SocialSignInCard', () => {
  it('should render the three 간편로그인 buttons in brand order', () => {
    // Arrange & Act
    render(<SocialSignInCard nextPath="/" />)

    // Assert — 문구는 각 제공자의 버튼 가이드를 따른다. 임의로 바꾸면 심사에서 걸린다.
    const labels = screen.getAllByRole('button').map((button) => button.textContent)
    expect(labels).toEqual(['구글로 계속하기', '카카오로 계속하기', '네이버로 계속하기'])
  })

  it('should submit the pressed provider as a form value', () => {
    // Arrange & Act
    render(<SocialSignInCard nextPath="/" />)

    // Assert — 눌린 버튼의 name/value 로 어떤 제공자를 골랐는지 전달한다.
    const values = screen
      .getAllByRole('button')
      .map((button) => (button as HTMLButtonElement).value)
    expect(values).toEqual(['google', 'kakao', 'naver'])
  })

  it('should carry the destination so the user returns after signing in', () => {
    // Arrange & Act
    const { container } = render(<SocialSignInCard nextPath="/community/write" />)

    // Assert
    const hidden = container.querySelector('input[name="next"]')
    expect(hidden).toHaveValue('/community/write')
  })

  it('should show the error the auth route handler passed in the query string', () => {
    // Arrange & Act
    render(<SocialSignInCard nextPath="/" initialError="아직 준비 중인 로그인 방식입니다." />)

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('아직 준비 중인 로그인 방식입니다.')
  })

  it('should link to both policies in the consent notice', () => {
    // Arrange & Act
    render(<SocialSignInCard nextPath="/" />)

    // Assert
    expect(screen.getByRole('link', { name: '이용약관' })).toHaveAttribute(
      'href',
      '/policy/operating',
    )
    expect(screen.getByRole('link', { name: '개인정보처리방침' })).toHaveAttribute(
      'href',
      '/policy/privacy',
    )
  })
})
