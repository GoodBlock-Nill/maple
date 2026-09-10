import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

/* 서버 액션 모듈은 supabase 서버 클라이언트를 끌고 오므로 jsdom 에서 그대로
   import 할 수 없다. 이 테스트의 관심사는 마크업이다. */
vi.mock('@/lib/actions/auth-actions', () => ({
  socialSignIn: async () => ({ formError: undefined }),
}))

const { LoginForm } = await import('@/components/auth/LoginForm')

describe('LoginForm', () => {
  it('should offer Google and 네이버 only', () => {
    // Arrange & Act — 시안(auth-v2)에서 카카오 버튼은 숨김이고 이메일 로그인은 없다.
    render(<LoginForm nextPath="/" />)

    const buttons = screen.getAllByRole('button')

    // Assert
    expect(buttons).toHaveLength(2)
    expect(buttons[0]).toHaveAccessibleName('Google로 계속하기')
    expect(buttons[1]).toHaveAccessibleName('네이버로 계속하기')
    expect(screen.queryByRole('button', { name: /Kakao|카카오/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('이메일')).not.toBeInTheDocument()
  })

  it('should submit the provider name and the sanitized next path', () => {
    // Arrange & Act
    render(<LoginForm nextPath="/community" />)

    // Assert — 액션은 눌린 버튼의 name/value 로 제공자를 받는다.
    expect(screen.getByRole('button', { name: 'Google로 계속하기' })).toHaveAttribute(
      'value',
      'google',
    )
    expect(screen.getByRole('button', { name: '네이버로 계속하기' })).toHaveAttribute(
      'value',
      'naver',
    )
    expect(document.querySelector('input[name="next"]')).toHaveValue('/community')
  })

  it('should keep the error row out of the page when there is no error', () => {
    // Arrange & Act
    render(<LoginForm nextPath="/" />)

    // Assert
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('should show the error row that the URL asked for', () => {
    // Arrange & Act
    render(<LoginForm nextPath="/" initialError="로그인에 실패했어요. 잠시 후 다시 시도해주세요" />)

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      '로그인에 실패했어요. 잠시 후 다시 시도해주세요',
    )
  })
})
