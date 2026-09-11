import { NextResponse } from 'next/server'

import { isWithdrawnProfile } from '@/lib/auth/lifecycle'
import { FEATURES } from '@/lib/constants/features'
import { updateSession } from '@/lib/supabase/middleware'
import {
  ACCOUNT_PATH,
  isOnboardingComplete,
  ONBOARDING_PATH,
  RESTORE_PATH,
} from '@/lib/validation/auth'

import type { TypedSupabaseClient } from '@/lib/supabase/types'
import type { NextRequest } from 'next/server'

/**
 * Next.js 16 부터 `middleware.ts` 는 `proxy.ts` 로 이름이 바뀌었다
 * (node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md).
 * 파일은 프로젝트 루트에 하나만 둘 수 있고, 함수는 default 또는 named `proxy` 로 내보낸다.
 *
 * 여기서 하는 일은 네 가지다.
 *  1) 사라진 경로(회원가입·비밀번호 찾기·재설정)를 로그인으로 보낸다.
 *  2) 모든 요청에서 Supabase 세션(액세스 토큰)을 갱신한다.
 *  3) 보호 경로에 대한 **낙관적(optimistic) 인증 검사**.
 *  4) 로그인 사용자의 상태 게이트 — 탈퇴 대기(`deleted_at`)면 복구 화면으로,
 *     온보딩 미완료면 온보딩으로 보낸다.
 *
 * 권한(admin) 판정은 여기서 하지 않는다. 실제 인가는 RLS 의 `public.is_admin()` 과
 * 각 페이지의 서버 검사에서 강제된다. 프록시는 "로그인 여부"만 걸러 낸다.
 */

/** GET 접근 시 로그인 페이지로 보낼 경로. */
const PROTECTED_PREFIXES = [
  '/admin',
  '/community/write',
  ONBOARDING_PATH,
  RESTORE_PATH,
  ACCOUNT_PATH,
] as const

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

/**
 * 탈퇴 대기 계정을 복구 화면으로 돌려보내는 경로 — "로그인한 사람만 쓰는 화면"
 * 전부다. 공개 읽기(목록·상세·뉴스)는 그대로 열어 둔다. 복구 화면 자체와 그 액션
 * (POST /auth/restore)은 당연히 제외한다.
 */
const WITHDRAWN_READ_PREFIXES = [
  '/community/write',
  ACCOUNT_PATH,
  ONBOARDING_PATH,
  '/support/inquiries',
] as const
const WITHDRAWN_MUTATION_PREFIXES = [
  '/community',
  '/support',
  ACCOUNT_PATH,
  ONBOARDING_PATH,
] as const

/**
 * 사라진 경로 → 살아 있는 경로. 북마크·구버전 링크를 위한 자리다.
 *
 * 로그인 수단이 간편로그인(구글·네이버)뿐이 되면서(2026-09-10 시안) 이메일
 * 가입·비밀번호 화면이 통째로 사라졌다. `/register` 는 페이지 자체가 308 로
 * `/login` 을 가리킨다.
 */
const LEGACY_REDIRECTS: Record<string, string> = {
  '/signup': '/login',
  '/forgot-password': '/login',
  '/reset-password': '/login',
  /* 마이페이지 v2(2026-09-11): 쿠폰·문의내역 탭이 사라졌다. 쿠폰은 화면 자체가
     없어졌고 문의 내역은 고객지원(`/support/inquiries`)이 이미 같은 목록을
     들고 있다. 두 경로는 남은 마이페이지로 돌려보낸다. */
  '/account/coupon': ACCOUNT_PATH,
  '/account/inquiries': ACCOUNT_PATH,
}

/**
 * 비활성화된 소개 메뉴가 가리키는 경로 접두사.
 *
 * 가이드·랭킹의 "서비스 준비 중"은 페이지 컴포넌트 안에서 안내 카드로 막지만
 * (`app/(public)/guide/page.tsx` 참고), 소개는 오너 요청으로 메뉴 항목 자체를
 * 비활성화한다 — 주소창으로 직접 들어오거나 옛 링크를 눌러도 화면이 남아
 * 있으면 안 되므로 URL 단계에서 홈으로 돌려보낸다. `FEATURES.aboutDisabled`
 * 가 꺼지면(오너가 배포 환경 변수를 `false` 로 바꾸면) 이 리다이렉트도 함께 풀린다.
 */
const ABOUT_DISABLED_PREFIX = '/about'

const LOGIN_PATH = '/login'

/* prettier-ignore — 한 줄 리터럴이어야 supabase-js 가 select 결과 타입을 추론한다. */
const GATE_COLUMNS =
  'nickname, terms_agreed_at, privacy_agreed_at, age_confirmed_at, msw_uid, msw_profile_code, deleted_at, purged_at'

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

type GateProfile = {
  nickname: string | null
  terms_agreed_at: string | null
  privacy_agreed_at: string | null
  age_confirmed_at: string | null
  msw_uid: string | null
  msw_profile_code: string | null
  deleted_at: string | null
  purged_at: string | null
}

/**
 * 상태 게이트에 필요한 프로필. 조회 실패는 "정상 회원"으로 본다(오탐 차단 방지) —
 * 쓰기는 어차피 RLS(`is_suspended()` · `is_withdrawn()`)가 최종적으로 막는다.
 */
async function readGateProfile(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<GateProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(GATE_COLUMNS)
    .eq('id', userId)
    .maybeSingle()

  return error !== null ? null : data
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl

  if (FEATURES.aboutDisabled && matchesPrefix(pathname, [ABOUT_DISABLED_PREFIX])) {
    // 302(임시). 오너가 플래그를 다시 켜면 경로도 바로 살아난다.
    return NextResponse.redirect(new URL('/', request.url), 302)
  }

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

  /* 복구 화면과 그 액션은 탈퇴 대기 계정이 가야 하는 곳이다. 게이트를 태우지 않는다. */
  const isRestoreRoute = matchesPrefix(pathname, [RESTORE_PATH])

  const needsWithdrawnGate =
    !isRestoreRoute &&
    (isRead
      ? matchesPrefix(pathname, WITHDRAWN_READ_PREFIXES)
      : matchesPrefix(pathname, WITHDRAWN_MUTATION_PREFIXES))
  const needsOnboarding = isRead
    ? matchesPrefix(pathname, ONBOARDING_READ_PREFIXES)
    : matchesPrefix(pathname, ONBOARDING_MUTATION_PREFIXES)

  /* 조회는 이 분기에서만 일어난다. 모든 요청마다 DB 를 때리지 않도록
     "게이트 대상 경로 + 로그인 상태"로 좁힌 뒤에야 프로필을 한 번 읽는다. */
  if (!needsWithdrawnGate && !needsOnboarding) {
    return response
  }

  const profile = await readGateProfile(supabase, user.id)

  if (needsWithdrawnGate && isWithdrawnProfile(profile)) {
    if (isRead) {
      const restoreUrl = new URL(RESTORE_PATH, request.url)
      restoreUrl.searchParams.set('next', `${pathname}${search}`)

      return redirectWithSession(response, restoreUrl)
    }

    return NextResponse.json(
      { error: 'account_withdrawn', restorePath: RESTORE_PATH },
      { status: 403 },
    )
  }

  if (!needsOnboarding || profile === null || isOnboardingComplete(profile)) {
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
