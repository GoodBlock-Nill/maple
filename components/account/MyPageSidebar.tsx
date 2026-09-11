import Link from 'next/link'

import {
  MYPAGE_BADGE_CLASS,
  MYPAGE_TAB_ACTIVE_CLASS,
  MYPAGE_TAB_CLASS,
  MYPAGE_TAB_ICON_BOX_CLASS,
  MYPAGE_TAB_LABEL_CLASS,
} from '@/components/account/mypage-styles'
import {
  isMyPageTabActive,
  MYPAGE_COMING_SOON_LABEL,
  MYPAGE_TABS,
} from '@/components/account/mypage-tabs'
import { cn } from '@/lib/utils/cn'

type MyPageSidebarProps = {
  /** 현재 경로. 페이지가 자기 경로를 그대로 넘긴다(클라이언트 훅을 쓰지 않는다). */
  activeHref: string
}

/**
 * 마이페이지 사이드바(268) — 탭 2개(시안 §2).
 *
 * 사용자 행(아바타·닉네임·로그아웃)은 v2 에서 사라졌다 — 로그아웃은 헤더 드롭다운
 * 한 곳에만 둔다.
 *
 * 1280 미만에서는 통째로 숨기고 카드 상단의 세그먼트 탭(`MyPageTabBar`)이 같은
 * 이동을 맡는다(시안 모바일 §6).
 */
export function MyPageSidebar({ activeHref }: MyPageSidebarProps) {
  return (
    <nav aria-label="마이페이지 메뉴" className="hidden w-[268px] shrink-0 xl:block">
      <ul className="flex flex-col gap-[10px]">
        {MYPAGE_TABS.map((tab) => {
          const isActive = isMyPageTabActive(activeHref, tab.href)

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  MYPAGE_TAB_CLASS,
                  isActive ? MYPAGE_TAB_ACTIVE_CLASS : 'hover:bg-white/60',
                )}
              >
                <span className={MYPAGE_TAB_ICON_BOX_CLASS}>
                  <tab.Icon className={cn('text-ink', tab.fillsBox ? 'size-12' : 'size-7')} />
                </span>
                <span className={MYPAGE_TAB_LABEL_CLASS}>{tab.label}</span>
                {tab.comingSoon ? (
                  <span className={MYPAGE_BADGE_CLASS}>{MYPAGE_COMING_SOON_LABEL}</span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
