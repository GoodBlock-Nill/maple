import Link from 'next/link'

import { MYPAGE_BADGE_SM_CLASS } from '@/components/account/mypage-styles'
import {
  isMyPageTabActive,
  MYPAGE_COMING_SOON_LABEL,
  MYPAGE_TABS,
} from '@/components/account/mypage-tabs'
import { cn } from '@/lib/utils/cn'

type MyPageTabBarProps = {
  activeHref: string
}

/**
 * 카드 맨 위의 세그먼트 탭(시안 모바일 §6) — 각 171.5×47, 활성은 #e8308a 라벨 +
 * 하단 2px 인디케이터.
 *
 * 1280 이상에서는 사이드바가 같은 이동을 맡으므로 숨긴다. 두 내비의 `aria-label`
 * 을 다르게 둔 이유는, 화면 폭에 따라 한쪽만 보이더라도 마크업에는 둘 다 있어서다.
 */
export function MyPageTabBar({ activeHref }: MyPageTabBarProps) {
  return (
    <nav aria-label="마이페이지 탭" className="border-line border-b xl:hidden">
      <ul className="flex">
        {MYPAGE_TABS.map((tab) => {
          const isActive = isMyPageTabActive(activeHref, tab.href)

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex h-[47px] items-center justify-center gap-[6px] border-b-2 text-[14px] font-medium transition-colors',
                  isActive
                    ? 'border-[#e8308a] text-[#e8308a]'
                    : 'border-transparent text-[#727272]',
                )}
              >
                {tab.label}
                {tab.comingSoon ? (
                  <span className={MYPAGE_BADGE_SM_CLASS}>{MYPAGE_COMING_SOON_LABEL}</span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
