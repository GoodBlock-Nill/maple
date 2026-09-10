import { redirect } from 'next/navigation'

import { OnboardingForm } from '@/components/auth/OnboardingForm'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { isWithdrawnProfile } from '@/lib/auth/lifecycle'
import { marketingConsentFallbackHtml } from '@/lib/content/marketing-consent-html'
import { ONBOARDING_COPY } from '@/lib/content/onboarding'
import { getLegalDocument } from '@/lib/data/legal'
import { createClient } from '@/lib/supabase/server'
import { firstValue } from '@/lib/utils/list-query'
import {
  isOnboardingComplete,
  ONBOARDING_PATH,
  RESTORE_PATH,
  sanitizePostAuthPath,
} from '@/lib/validation/auth'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: ONBOARDING_COPY.title,
  description: ONBOARDING_COPY.subtitle,
  robots: { index: false, follow: false },
}

const MAIN_ID = 'main-content'

/**
 * 최초 로그인 온보딩 — 회원가입 v2 시안(Figma 2UmKcpmy55IqMZ7Sg6vTeW 27:5172).
 *
 * 1440 기준 실측값: 페이지 배경 #f6f7fa · 카드 600×656 @ (420,200) · 푸터 y=962
 * (프레임 1550). 세로 자리는 `ONBOARDING_PAGE_CLASS` 의 위·아래 여백이 만든다.
 *
 * 헤더에는 **로그인 알약**이 선다(시안 그대로). 세션은 이미 있지만 약관 동의를
 * 마치기 전까지는 글쓰기·댓글이 열리지 않는 반쪽 계정이라, 헤더에 마이페이지·
 * 로그아웃 메뉴를 먼저 열어 주지 않는다.
 *
 * 프록시가 미로그인 접근을 이미 걸러 내지만, 페이지에서도 다시 확인한다.
 * 프록시는 낙관적 검사일 뿐이고 인가의 최종 판단은 서버(그리고 RLS)에 있다.
 */
export default async function OnboardingPage(props: PageProps<'/auth/onboarding'>) {
  const searchParams = await props.searchParams
  const nextPath = sanitizePostAuthPath(firstValue(searchParams.next))

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user === null) {
    redirect(`/login?next=${encodeURIComponent(ONBOARDING_PATH)}`)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'nickname, terms_agreed_at, privacy_agreed_at, age_confirmed_at, msw_uid, msw_profile_code, deleted_at, purged_at',
    )
    .eq('id', user.id)
    .maybeSingle()

  // 탈퇴 대기 계정은 약관을 다시 받기 전에 복구 여부를 먼저 묻는다.
  if (isWithdrawnProfile(profile)) {
    redirect(`${RESTORE_PATH}?next=${encodeURIComponent(nextPath)}`)
  }

  // 이미 마친 사람이 주소로 직접 들어온 경우. 다시 묻지 않는다.
  if (isOnboardingComplete(profile)) {
    redirect(nextPath)
  }

  /* 마케팅 안내는 관리자가 개정할 수 있는 발행 문서다. 발행본이 없거나 조회가
     실패하면 코드 문안으로 떨어진다 — 회원가입은 DB 사정과 무관하게 열려야 한다. */
  const marketingDocument = await getLegalDocument('marketing')

  return (
    <>
      <a
        href={`#${MAIN_ID}`}
        className="rounded-pill focus:bg-ink focus:shadow-card-hover sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-white"
      >
        본문으로 건너뛰기
      </a>
      <SiteHeader />

      <main id={MAIN_ID} className="relative isolate overflow-x-clip bg-[#f6f7fa]">
        <OnboardingForm
          nextPath={nextPath}
          defaultNickname={profile?.nickname ?? ''}
          defaultMswUid={profile?.msw_uid ?? ''}
          defaultMswProfileCode={profile?.msw_profile_code ?? ''}
          marketingConsentHtml={marketingDocument?.contentHtml ?? marketingConsentFallbackHtml()}
        />
      </main>

      <SiteFooter variant="home" />
    </>
  )
}
