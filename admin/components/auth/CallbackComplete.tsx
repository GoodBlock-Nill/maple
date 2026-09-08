'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { establishSessionAction } from '@/lib/actions/auth-actions'

/**
 * 암시적 흐름(`#access_token=…`)으로 돌아온 인증 링크를 마무리한다.
 *
 * 해시는 브라우저를 벗어나지 않으므로 서버 라우트가 볼 수 없다. 여기서 읽어
 * 서버 액션으로 넘기면 `setSession()` 이 httpOnly 쿠키로 옮겨 준다 — 토큰이
 * localStorage 처럼 자바스크립트가 접근 가능한 곳에 남지 않는다.
 *
 * 넘긴 직후 `history.replaceState` 로 주소창의 해시를 지운다. 남겨 두면 뒤로가기
 * 기록·화면 공유·북마크에 액세스 토큰이 그대로 실린다.
 */
export function CallbackComplete({ nextPath }: { nextPath: string }) {
  const router = useRouter()
  const hasRunRef = useRef(false)

  useEffect(() => {
    // React 18+ 개발 모드는 이펙트를 두 번 돌린다. 토큰 교환은 한 번만 해야 한다.
    if (hasRunRef.current) {
      return
    }

    hasRunRef.current = true

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const accessToken = params.get('access_token') ?? ''
    const refreshToken = params.get('refresh_token') ?? ''

    if (params.get('error') !== null) {
      router.replace('/login?error=link_expired')

      return
    }

    if (accessToken === '' || refreshToken === '') {
      router.replace('/login?error=invalid_link')

      return
    }

    void establishSessionAction(accessToken, refreshToken).then((state) => {
      window.history.replaceState(null, '', window.location.pathname)

      if (state.formError !== undefined) {
        router.replace('/login?error=link_expired')

        return
      }

      router.replace(nextPath)
      router.refresh()
    })
  }, [router, nextPath])

  return (
    <p aria-live="polite" className="text-muted text-[14px]">
      로그인 처리 중입니다…
    </p>
  )
}
