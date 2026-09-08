import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { sanitizeNextPath } from '@/lib/validation/auth'

import type { NextRequest } from 'next/server'

/**
 * PKCE 인증 코드 교환 엔드포인트.
 *
 * `@supabase/ssr` 의 서버 클라이언트는 PKCE 플로우를 쓰므로, 메일 링크/소셜
 * 로그인은 `?code=` 를 들고 여기로 돌아온다. 코드를 세션으로 바꾸면 쿠키가
 * 응답에 실린다 — 라우트 핸들러는 쿠키를 쓸 수 있는 위치다.
 *
 * `next` 는 반드시 정규화한다. 그대로 리다이렉트하면 오픈 리다이렉트가 된다.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const nextPath = sanitizeNextPath(searchParams.get('next'))

  if (code === null) {
    return NextResponse.redirect(new URL('/login?error=missing_code', origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error !== null) {
    return NextResponse.redirect(new URL('/login?error=auth_failed', origin))
  }

  return NextResponse.redirect(new URL(nextPath, origin))
}
