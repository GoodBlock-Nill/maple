import { NextResponse } from 'next/server'

import { buildLastSeenCookie, isInactive, LAST_SEEN_COOKIE } from '@/lib/auth/session'
import { updateSession } from '@/lib/supabase/middleware'

import type { NextRequest } from 'next/server'

/**
 * Next.js 16 부터 `middleware.ts` 는 `proxy.ts` 로 이름이 바뀌었다
 * (node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md).
 * 파일은 프로젝트 루트에 하나만 둘 수 있고, 함수는 default 또는 named `proxy` 로 내보낸다.
 *
 * 여기서 하는 일은 세 가지다.
 *  1) 모든 요청에서 Supabase 세션(액세스 토큰)을 갱신한다.
 *  2) 미로그인 요청을 `/login` 으로 돌린다(낙관적 검사).
 *  3) 30분 비활동 세션을 만료시킨다.
 *
 * 권한(admin) 판정은 여기서 하지 않는다. 문서가 경고하듯 프록시는 세션 관리·인가의
 * 완결된 해법이 아니다. 실제 인가는 각 페이지의 `requireAdmin()` 과 RLS 의
 * `public.is_admin()` 두 겹이 강제한다.
 */

/** 로그인하지 않아도 열리는 경로. 인증 메일 링크의 착지점이 모두 포함된다. */
const PUBLIC_PREFIXES = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/invite/accept',
  '/auth/callback',
] as const

const LOGIN_PATH = '/login'

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

/**
 * 리다이렉트 응답에 갱신된 인증 쿠키를 옮겨 싣는다.
 *
 * `updateSession()` 이 새 토큰을 심은 응답을 버리고 새 응답을 만들면, 리프레시된
 * 토큰이 브라우저에 저장되지 않아 관리자가 임의로 로그아웃된다. 로그아웃 시에는
 * 반대로 "삭제 쿠키"가 실려 있어 같은 이유로 반드시 복사해야 한다.
 */
function redirectWithSession(response: NextResponse, url: URL): NextResponse {
  const redirectResponse = NextResponse.redirect(url)

  for (const cookie of response.cookies.getAll()) {
    redirectResponse.cookies.set(cookie)
  }

  return redirectResponse
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search, protocol } = request.nextUrl
  const isPublic = matchesPrefix(pathname, PUBLIC_PREFIXES)
  const { response, user, supabase } = await updateSession(request)

  if (user === null) {
    if (isPublic) {
      return response
    }

    const loginUrl = new URL(LOGIN_PATH, request.url)
    // 로그인 후 원래 가려던 곳으로 돌려보낸다. 쿼리스트링까지 보존한다.
    loginUrl.searchParams.set('next', `${pathname}${search}`)

    return redirectWithSession(response, loginUrl)
  }

  const now = Date.now()

  if (isInactive(request.cookies.get(LAST_SEEN_COOKIE)?.value, now)) {
    // signOut() 이 심는 "삭제 쿠키"가 response 에 실린다. 그대로 리다이렉트에 옮긴다.
    await supabase.auth.signOut()

    const expiredUrl = new URL(LOGIN_PATH, request.url)
    expiredUrl.searchParams.set('error', 'expired')

    const expiredResponse = redirectWithSession(response, expiredUrl)
    expiredResponse.cookies.delete(LAST_SEEN_COOKIE)

    return expiredResponse
  }

  const stamp = buildLastSeenCookie(now, protocol === 'https:')

  // 로그인 상태로 로그인 화면에 오면 대시보드로 돌린다(뒤로가기로 흔히 발생).
  if (pathname === LOGIN_PATH) {
    const home = redirectWithSession(response, new URL('/', request.url))
    home.cookies.set(stamp.name, stamp.value, stamp.options)

    return home
  }

  response.cookies.set(stamp.name, stamp.value, stamp.options)

  return response
}

export const config = {
  matcher: [
    /*
     * 정적 자산은 프록시를 태우지 않는다. 통과시키면 CSS/JS/폰트 요청마다
     * Auth 서버 왕복이 생긴다.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf|otf)$).*)',
  ],
}
