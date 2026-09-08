import { NextResponse } from 'next/server'

import { updateSession } from '@/lib/supabase/middleware'
import { isOnboardingComplete, ONBOARDING_PATH } from '@/lib/validation/auth'

import type { TypedSupabaseClient } from '@/lib/supabase/types'
import type { NextRequest } from 'next/server'

/**
 * Next.js 16 부터 `middleware.ts` 는 `proxy.ts` 로 이름이 바뀌었다
 * (node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md).
 * 파일은 프로젝트 루트에 하나만 둘 수 있고, 함수는 default 또는 named `proxy` 로 내보낸다.
 *
 * 여기서 하는 일은 세 가지다.
 *  1) 사라진 경로(비밀번호 찾기)를 로그인으로 보낸다.
 *  2) 모든 요청에서 Supabase 세션(액세스 토큰)을 갱신한다.
 *  3) 보호 경로에 대한 **낙관적(optimistic) 인증 검사** + 온보딩 미완료 차단.
 *
 * 권한(admin) 판정은 여기서 하지 않는다. 실제 인가는 RLS 의 `public.is_admin()` 과
 * 각 페이지의 서버 검사에서 강제된다. 프록시는 "로그인 여부"만 걸러 낸다.
 */

/** GET 접근 시 로그인 페이지로 보낼 경로. */
const PROTECTED_PREFIXES = ['/admin', '/community/write', ONBOARDING_PATH] as const

/** 비-GET(폼 제출·서버 액션)일 때만 로그인을 요구하는 경로. */
const PROTECTED_MUTATION_PREFIXES = ['/support'] as const

/**
 * 온보딩(닉네임 확정 + 약관 동의)을 마쳐야 열리는 경로.
 *
 * 읽기는 계속 열어 둔다. 막는 것은 "쓰기"뿐이다 — 글쓰기 화면 진입(GET)과
 * 커뮤니티·고객지원에서 발생하는 모든 쓰기 요청(서버 액션 POST)이다.
 * 서버 액션은 현재 페이지 경로로 POST 되므로 `/community` 접두사로 댓글까지 덮인다.
 */
const ONBOARDING_READ_PREFIXES = ['/community/write'] as const
const ONBOARDING_MUTATION_PREFIXES = ['/community', '/support'] as const

/** 이메일 로그인 제거로 사라진 경로. 북마크·구버전 링크를 위해 살려 둔다. */
const LEGACY_REDIRECTS: Record<string, string> = {
  '/forgot-password': '/login',
}

const LOGIN_PATH = '/login'

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

/**
 * 리다이렉트 응답에 갱신된 인증 쿠키를 옮겨 싣는다.
 *
 * `updateSession()` 이 새 토큰을 심은 응답을 버리고 새 응답을 만들면, 리프레시된
 * 토큰이 브라우저에 저장되지 않아 사용자가 임의로 로그아웃된다.
 */
function redirectWithSession(response: NextResponse, url: URL): NextResponse {
  const redirectResponse = NextResponse.redirect(url)

  for (const cookie of response.cookies.getAll()) {
    redirectResponse.cookies.set(cookie)
  }

  return redirectResponse
}

/** 온보딩을 마쳤는지 확인한다. 조회 실패는 "미완료"로 보지 않는다(오탐 차단). */
async function hasCompletedOnboarding(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'nickname, terms_agreed_at, privacy_agreed_at, age_confirmed_at, msw_uid, msw_profile_code',
    )
    .eq('id', userId)
    .maybeSingle()

  if (error !== null) {
    return true
  }

  return isOnboardingComplete(data)
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl
  const legacyTarget = LEGACY_REDIRECTS[pathname]

  if (legacyTarget !== undefined) {
    // 302(임시). 경로가 되살아날 여지를 남기고 캐시에도 박히지 않는다.
    return NextResponse.redirect(new URL(legacyTarget, request.url), 302)
  }

  const { response, user, supabase } = await updateSession(request)
  const isRead = request.method === 'GET' || request.method === 'HEAD'

  if (user === null) {
    if (isRead && matchesPrefix(pathname, PROTECTED_PREFIXES)) {
      const loginUrl = new URL(LOGIN_PATH, request.url)
      // 로그인 후 원래 가려던 곳으로 돌려보낸다. 쿼리스트링까지 보존한다.
      loginUrl.searchParams.set('next', `${pathname}${search}`)

      return NextResponse.redirect(loginUrl)
    }

    if (
      !isRead &&
      matchesPrefix(pathname, [...PROTECTED_PREFIXES, ...PROTECTED_MUTATION_PREFIXES])
    ) {
      // POST 를 로그인 페이지로 리다이렉트하면 본문이 유실되고 서버 액션이 깨진다.
      // 상태 코드로 알리고 클라이언트가 로그인 모달/이동을 결정하게 한다.
      return NextResponse.json({ error: 'unauthorized', loginPath: LOGIN_PATH }, { status: 401 })
    }

    return response
  }

  const needsOnboarding = isRead
    ? matchesPrefix(pathname, ONBOARDING_READ_PREFIXES)
    : matchesPrefix(pathname, ONBOARDING_MUTATION_PREFIXES)

  /* 조회는 이 분기에서만 일어난다. 모든 요청마다 DB 를 때리지 않도록
     "쓰기 경로 + 로그인 상태"로 좁힌 뒤에야 프로필을 읽는다. */
  if (!needsOnboarding || (await hasCompletedOnboarding(supabase, user.id))) {
    return response
  }

  if (isRead) {
    const onboardingUrl = new URL(ONBOARDING_PATH, request.url)
    onboardingUrl.searchParams.set('next', `${pathname}${search}`)

    return redirectWithSession(response, onboardingUrl)
  }

  return NextResponse.json(
    { error: 'onboarding_required', onboardingPath: ONBOARDING_PATH },
    { status: 403 },
  )
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
