import { NextResponse } from 'next/server'

import { updateSession } from '@/lib/supabase/middleware'

import type { NextRequest } from 'next/server'

/**
 * Next.js 16 부터 `middleware.ts` 는 `proxy.ts` 로 이름이 바뀌었다
 * (node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md).
 * 파일은 프로젝트 루트에 하나만 둘 수 있고, 함수는 default 또는 named `proxy` 로 내보낸다.
 *
 * 여기서 하는 일은 두 가지다.
 *  1) 모든 요청에서 Supabase 세션(액세스 토큰)을 갱신한다.
 *  2) 보호 경로에 대한 **낙관적(optimistic) 인증 검사**.
 *
 * 권한(admin) 판정은 여기서 하지 않는다. 프록시는 DB 조회를 하기에 적절한 위치가
 * 아니고(공식 문서도 권장하지 않는다), 실제 인가는 RLS 의 `public.is_admin()` 과
 * 각 페이지의 서버 검사에서 강제된다. 프록시는 "로그인 여부"만 걸러 낸다.
 */

/** GET 접근 시 로그인 페이지로 보낼 경로. */
const PROTECTED_PREFIXES = ['/admin', '/community/write'] as const

/** 비-GET(폼 제출·서버 액션)일 때만 로그인을 요구하는 경로. */
const PROTECTED_MUTATION_PREFIXES = ['/support'] as const

const LOGIN_PATH = '/login'

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { response, user } = await updateSession(request)

  if (user !== null) {
    return response
  }

  const { pathname, search } = request.nextUrl
  const isRead = request.method === 'GET' || request.method === 'HEAD'

  if (isRead && matchesPrefix(pathname, PROTECTED_PREFIXES)) {
    const loginUrl = new URL(LOGIN_PATH, request.url)
    // 로그인 후 원래 가려던 곳으로 돌려보낸다. 쿼리스트링까지 보존한다.
    loginUrl.searchParams.set('next', `${pathname}${search}`)

    return NextResponse.redirect(loginUrl)
  }

  if (!isRead && matchesPrefix(pathname, [...PROTECTED_PREFIXES, ...PROTECTED_MUTATION_PREFIXES])) {
    // POST 를 로그인 페이지로 리다이렉트하면 본문이 유실되고 서버 액션이 깨진다.
    // 상태 코드로 알리고 클라이언트가 로그인 모달/이동을 결정하게 한다.
    return NextResponse.json({ error: 'unauthorized', loginPath: LOGIN_PATH }, { status: 401 })
  }

  return response
}

export const config = {
  matcher: [
    /*
     * 정적 자산은 프록시를 태우지 않는다. 통과시키면 CSS/JS/이미지 요청마다
     * Auth 서버 왕복이 생기고, 리다이렉트 규칙에 걸려 자산이 깨질 수 있다.
     * 제외 대상: Next 내부 자산 · /images(배경·마스코트) · 파비콘 · 폰트/이미지 확장자.
     */
    '/((?!_next/static|_next/image|images/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf)$).*)',
  ],
}
