import { GoogleMark, KakaoMark, NaverMark } from '@/components/auth/social-icons'
import { SOCIAL_PROVIDERS } from '@/lib/validation/auth'

import type { SocialProvider } from '@/lib/validation/auth'
import type { ReactNode } from 'react'

/**
 * 간편로그인 버튼의 브랜드 표기.
 *
 * 색·문구는 각 제공자의 로그인 버튼 가이드를 따른다. 임의로 바꾸면 심사에서
 * 반려될 수 있으므로 한곳에 모아 두고 화면에서는 이 값만 읽는다. 사용자
 * 사이트의 같은 파일과 **같은 값**이다 — 두 사이트의 로그인 버튼이 달라 보이면
 * "같은 계정으로 들어가는 문"이라는 사실이 전달되지 않는다.
 */

export type SocialProviderStyle = {
  provider: SocialProvider
  /** 버튼 문구. 가이드가 권장하는 "…로 계속하기" 형태를 쓴다. */
  label: string
  /** 표면(배경·테두리·글자색) 유틸리티. */
  surfaceClass: string
  icon: ReactNode
}

const ICON_CLASS = 'h-[18px] w-[18px] shrink-0'

const STYLE: Record<SocialProvider, Omit<SocialProviderStyle, 'provider'>> = {
  google: {
    label: '구글로 계속하기',
    surfaceClass: 'border border-[#dadce0] bg-white text-[#1f1f1f] hover:bg-[#f8f9fa]',
    icon: <GoogleMark className={ICON_CLASS} />,
  },
  kakao: {
    label: '카카오로 계속하기',
    // 카카오 가이드: 배경 #FEE500, 글자·심볼은 검정 85%.
    surfaceClass: 'border border-[#FEE500] bg-[#FEE500] text-[#191919]/85 hover:brightness-95',
    icon: <KakaoMark className={ICON_CLASS} />,
  },
  naver: {
    label: '네이버로 계속하기',
    surfaceClass: 'border border-[#03C75A] bg-[#03C75A] text-white hover:brightness-95',
    icon: <NaverMark className={ICON_CLASS} />,
  },
}

export const SOCIAL_PROVIDER_STYLES: readonly SocialProviderStyle[] = SOCIAL_PROVIDERS.map(
  (provider) => ({ provider, ...STYLE[provider] }),
)
