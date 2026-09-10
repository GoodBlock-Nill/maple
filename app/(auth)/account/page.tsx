import { redirect } from 'next/navigation'

import { AccountForm } from '@/components/auth/AccountForm'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthShell } from '@/components/auth/AuthShell'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { EmailMark, GoogleMark, KakaoMark, NaverMark } from '@/components/auth/social-icons'
import { WithdrawAccountButton } from '@/components/auth/WithdrawAccountButton'
import { isWithdrawnProfile, WITHDRAWAL_RETENTION_DAYS } from '@/lib/auth/lifecycle'
import { getAccountProfile } from '@/lib/data/profiles'
import { createClient } from '@/lib/supabase/server'
import { formatDateLong } from '@/lib/utils/format-date'
import {
  ACCOUNT_PATH,
  isOnboardingComplete,
  isSocialProvider,
  ONBOARDING_PATH,
  RESTORE_PATH,
  SOCIAL_PROVIDER_LABEL,
} from '@/lib/validation/auth'

import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: '내 정보',
  description: '닉네임과 가입 정보를 확인하고 관리합니다.',
  robots: { index: false, follow: false },
}

const LOGIN_PATH = '/login'

const PROVIDER_ICON_CLASS = 'h-[18px] w-[18px] shrink-0'

/**
 * "로그인 방식" 행에 쓰는 아이콘 + 문구.
 *
 * 카카오·네이버 마크는 `currentColor` 로 그려져(social-icons.tsx) 브랜드 버튼
 * 배경 위에서만 자체적으로 색이 완성된다. 여기서는 흰 배경 위에 놓이므로
 * 브랜드 색을 직접 입힌다. 알 수 없는 값(레거시 이메일 계정 등)은 안전하게
 * "이메일"로 폴백한다.
 */
function providerBadge(provider: string | null): { label: string; icon: ReactNode } {
  if (isSocialProvider(provider)) {
    const icon =
      provider === 'google' ? (
        <GoogleMark className={PROVIDER_ICON_CLASS} />
      ) : provider === 'kakao' ? (
        <KakaoMark className={`${PROVIDER_ICON_CLASS} text-[#191919]`} />
      ) : (
        <NaverMark className={`${PROVIDER_ICON_CLASS} text-[#03C75A]`} />
      )

    return { label: SOCIAL_PROVIDER_LABEL[provider], icon }
  }

  return {
    label: '이메일',
    icon: <EmailMark className={`${PROVIDER_ICON_CLASS} text-ink-muted`} />,
  }
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3">
      <span className="text-ink-muted text-[13px] font-bold">{label}</span>
      <div className="text-ink text-[15px]">{children}</div>
    </div>
  )
}

/**
 * "내 정보" 화면.
 *
 * 프록시가 낙관적 검사를 하지만(현재는 `/account` 를 보호 경로에 넣지 않았다),
 * 온보딩 페이지와 같은 원칙으로 여기서도 다시 확인한다 — 인가의 최종 판단은
 * 서버(그리고 RLS)에 있다.
 */
export default async function AccountPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user === null) {
    redirect(`${LOGIN_PATH}?next=${encodeURIComponent(ACCOUNT_PATH)}`)
  }

  const profile = await getAccountProfile(user.id)

  // 탈퇴 대기 계정은 먼저 복구를 묻는다(프록시도 같은 판정을 하지만 여기서 다시 확인한다).
  if (isWithdrawnProfile(profile)) {
    redirect(`${RESTORE_PATH}?next=${encodeURIComponent(ACCOUNT_PATH)}`)
  }

  if (profile === null || !isOnboardingComplete(profile)) {
    redirect(`${ONBOARDING_PATH}?next=${encodeURIComponent(ACCOUNT_PATH)}`)
  }

  const { label: providerLabel, icon: providerIcon } = providerBadge(profile.provider)

  return (
    /* `(auth)` 레이아웃은 더 이상 셸을 씌우지 않는다(로그인·회원가입이 각자
       시안 배경을 그린다). 이 화면은 기존 셸을 계속 쓴다. */
    <AuthShell>
      <AuthCard title="내 정보" description="닉네임과 메이플스토리 월드 계정을 관리할 수 있습니다.">
        <div className="flex flex-col gap-6">
          <AccountForm
            defaultNickname={profile.nickname}
            defaultMswUid={profile.msw_uid ?? ''}
            defaultMswProfileCode={profile.msw_profile_code ?? ''}
          />

          <div className="border-line-soft divide-line-soft divide-y border-t">
            <InfoRow label="로그인 방식">
              <span className="inline-flex items-center gap-2">
                {providerIcon}
                {providerLabel}
              </span>
            </InfoRow>

            <InfoRow label="가입일">{formatDateLong(profile.created_at)}</InfoRow>

            <InfoRow label="약관·개인정보 동의 일시">
              <span className="flex flex-col gap-0.5">
                <span>
                  이용약관:{' '}
                  {profile.terms_agreed_at === null ? '-' : formatDateLong(profile.terms_agreed_at)}
                </span>
                <span>
                  개인정보처리방침:{' '}
                  {profile.privacy_agreed_at === null
                    ? '-'
                    : formatDateLong(profile.privacy_agreed_at)}
                </span>
              </span>
            </InfoRow>
          </div>

          <LogoutButton variant="light" size="lg" className="w-full" />

          {/* 되돌리기 어려운 조작이라 화면 맨 아래, 로그아웃과도 떨어진 자리에 둔다. */}
          <section
            aria-labelledby="withdraw-heading"
            className="border-line-soft flex flex-col gap-2 border-t pt-6"
          >
            <h2 id="withdraw-heading" className="text-ink text-[15px] font-bold">
              회원 탈퇴
            </h2>
            <p className="text-ink-muted text-[14px] leading-[1.6]">
              탈퇴 후 {WITHDRAWAL_RETENTION_DAYS}일 동안 개인정보가 보존되며, 그 안에 다시
              로그인하면 복구됩니다. 작성한 글과 댓글은 남습니다.
            </p>
            <WithdrawAccountButton />
          </section>
        </div>
      </AuthCard>
    </AuthShell>
  )
}
