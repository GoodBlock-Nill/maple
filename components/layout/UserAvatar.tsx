import { GoogleMark, KakaoMark, NaverMark } from '@/components/auth/social-icons'
import { cn } from '@/lib/utils/cn'

import type { SocialProvider } from '@/lib/validation/auth'
import type { ComponentType } from 'react'

type IconProps = { className?: string }

type UserAvatarProps = {
  nickname: string
  /** 프로필 사진. 지금은 스텁 로그인이 채우지 않아 대부분 null. */
  avatarUrl?: string | null
  /** 간편로그인 제공자. 레거시 이메일 계정 등 모르는 값이면 null. */
  provider?: SocialProvider | null
  /** 원 지름 프리셋 — 헤더 트리거는 28px(`sm`), 모바일 드로어 사용자 블록은 32px(`md`). */
  size: 'sm' | 'md'
  className?: string
}

/**
 * 제공자별 원 배경·마크 색.
 *
 * 색은 각 제공자의 로그인 버튼 가이드(`components/auth/auth-icons.tsx`)와
 * 같다 — 아바타에서도 다른 색을 쓰면 사용자가 "이게 그 카카오 로그인 맞나"
 * 헷갈린다.
 */
const PROVIDER_STYLE: Record<
  SocialProvider,
  { circleClass: string; Mark: ComponentType<IconProps>; markTint: string }
> = {
  google: {
    circleClass: 'border border-[#dadce0] bg-white',
    Mark: GoogleMark,
    markTint: '',
  },
  kakao: {
    // 카카오 가이드: 심볼은 검정 85%.
    circleClass: 'bg-[#FEE500]',
    Mark: KakaoMark,
    markTint: 'text-[#191919]/85',
  },
  naver: {
    circleClass: 'bg-[#03C75A]',
    Mark: NaverMark,
    markTint: 'text-white',
  },
}

const CIRCLE_SIZE_CLASS: Record<UserAvatarProps['size'], string> = {
  sm: 'size-7', // 28px
  md: 'size-8', // 32px
}

const FALLBACK_TEXT_CLASS: Record<UserAvatarProps['size'], string> = {
  sm: 'text-[13px]',
  md: 'text-[14px]',
}

/** 구글/카카오 마크 크기 — 28px 원 기준 16px, 32px 원 기준 18px(같은 비율). */
const BRAND_MARK_SIZE_CLASS: Record<UserAvatarProps['size'], string> = {
  sm: 'size-4', // 16px
  md: 'size-[18px]',
}

/** 네이버 N 마크는 다른 마크보다 작게 그려야 시각적으로 균형이 맞는다(가이드 권장). */
const NAVER_MARK_SIZE_CLASS: Record<UserAvatarProps['size'], string> = {
  sm: 'size-3.5', // 14px
  md: 'size-4', // 16px
}

/** 사진이 있을 때 우하단에 얹는 제공자 배지 지름. */
const BADGE_SIZE_CLASS: Record<UserAvatarProps['size'], string> = {
  sm: 'size-3', // 12px
  md: 'size-3.5', // 14px
}

/** 배지 안에 들어가는 마크는 배지보다 한 단계 작게 그려야 배경 여백이 남는다. */
const BADGE_MARK_SIZE_CLASS: Record<UserAvatarProps['size'], string> = {
  sm: 'size-2', // 8px
  md: 'size-2.5', // 10px
}

function markSizeClass(provider: SocialProvider, size: UserAvatarProps['size']): string {
  return provider === 'naver' ? NAVER_MARK_SIZE_CLASS[size] : BRAND_MARK_SIZE_CLASS[size]
}

/** provider 와 그 스타일을 한 객체로 묶어서 반환한다 — 이렇게 해야 `style` 이
    있을 때 `provider` 도 non-null 이라는 걸 타입이 그대로 좁혀 안다(단언 없이). */
function resolveProviderStyle(provider: SocialProvider | null) {
  if (provider === null) return null
  return { provider, ...PROVIDER_STYLE[provider] }
}

/**
 * 헤더 닉네임 트리거·모바일 드로어 사용자 블록에서 반복되는 아바타.
 *
 * 우선순위는 프로필 사진 > 간편로그인 제공자 브랜드 마크 > 닉네임 첫 글자다.
 * 지금은 스텁 로그인이 `avatar_url` 을 채우지 않으므로 실제로는 항상 브랜드
 * 마크(또는 폴백)만 그려지지만, 실 OAuth 연동 후 사진이 들어오는 경우를 미리
 * 대비해 마크를 우하단 배지로 얹는 분기를 지금 넣어 둔다.
 *
 * 마크는 장식일 뿐이라 `aria-hidden` 이고, 트리거의 접근 가능한 이름은 항상
 * 닉네임 텍스트만으로 결정된다(레이아웃 쉬프트도, 이름 변경도 없다).
 */
export function UserAvatar({
  nickname,
  avatarUrl = null,
  provider = null,
  size,
  className,
}: UserAvatarProps) {
  const style = resolveProviderStyle(provider)

  if (avatarUrl) {
    return (
      <span className={cn('relative inline-block shrink-0', CIRCLE_SIZE_CLASS[size], className)}>
        {/* 임의 외부 호스트(제공자 아바타)라 next.config 의 remotePatterns
            화이트리스트로는 감당 못 한다. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl} alt="" className="size-full rounded-full object-cover" />
        {style ? (
          <span
            aria-hidden
            className={cn(
              'absolute -right-0.5 -bottom-0.5 flex items-center justify-center rounded-full ring-2 ring-white',
              BADGE_SIZE_CLASS[size],
              style.circleClass,
            )}
          >
            <style.Mark className={cn(BADGE_MARK_SIZE_CLASS[size], style.markTint)} />
          </span>
        ) : null}
      </span>
    )
  }

  if (style) {
    return (
      <span
        aria-hidden
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full',
          CIRCLE_SIZE_CLASS[size],
          style.circleClass,
          className,
        )}
      >
        <style.Mark className={cn(markSizeClass(style.provider, size), style.markTint)} />
      </span>
    )
  }

  // 이메일/알 수 없는 제공자(레거시 계정) — 브랜드 마크가 없으니 첫 글자로 폴백한다.
  return (
    <span
      aria-hidden
      className={cn(
        'bg-sheet text-ink flex shrink-0 items-center justify-center rounded-full font-semibold',
        CIRCLE_SIZE_CLASS[size],
        FALLBACK_TEXT_CLASS[size],
        className,
      )}
    >
      {nickname.charAt(0)}
    </span>
  )
}
