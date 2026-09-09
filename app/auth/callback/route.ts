import { NextResponse } from 'next/server'

import { resolvePostAuthDestination } from '@/lib/auth/lifecycle'
import { createClient } from '@/lib/supabase/server'

import type { NextRequest } from 'next/server'

/**
 * PKCE 인증 코드 교환 엔드포인트.
 *
 * `@supabase/ssr` 의 서버 클라이언트는 PKCE 플로우를 쓰므로, 소셜 로그인은
 * `?code=` 를 들고 여기로 돌아온다. 코드를 세션으로 바꾸면 쿠키가 응답에 실린다
 * — 라우트 핸들러는 쿠키를 쓸 수 있는 위치다.
 *
 * TODO(auth): 지금 로그인 버튼은 스텁이라 이 경로를 지나지 않는다. 개발팀이 실
 * OAuth(구글·카카오)를 붙이면 그때부터 여기가 진입점이 된다. 미리 온보딩 분기까지
 * 맞춰 둔다.
 *
 * `next` 는 반드시 정규화한다(`resolvePostAuthDestination` 안의 `sanitizePostAuthPath`).
 * 그대로 리다이렉트하면 오픈 리다이렉트가 된다.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')

  // 제공자가 사용자 취소·설정 오류를 알릴 때 쓰는 규격(OAuth 2.0 §4.1.2.1).
  if (searchParams.get('error') !== null) {
    return NextResponse.redirect(new URL('/login?error=oauth_failed', origin))
  }

  if (code === null) {
    return NextResponse.redirect(new URL('/login?error=missing_code', origin))
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error !== null || data.user === null) {
    return NextResponse.redirect(new URL('/login?error=auth_failed', origin))
  }

  /* 탈퇴 대기(deleted_at) → /auth/restore, 온보딩 미완료 → /auth/onboarding, 그 외 → next.
     스텁 로그인(`stubSocialSignIn`)과 같은 함수로 판정한다. */
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'nickname, terms_agreed_at, privacy_agreed_at, age_confirmed_at, msw_uid, msw_profile_code, deleted_at, purged_at',
    )
    .eq('id', data.user.id)
    .maybeSingle()

  return NextResponse.redirect(
    new URL(resolvePostAuthDestination(profile, searchParams.get('next')), origin),
  )
}
