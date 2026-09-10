import Link from 'next/link'

import { LogoutGlyph } from '@/components/account/mypage-icons'
import {
  MYPAGE_DIVIDER_CLASS,
  MYPAGE_TAB_ACTIVE_CLASS,
  MYPAGE_TAB_CLASS,
  MYPAGE_TAB_ICON_BOX_CLASS,
  MYPAGE_TAB_LABEL_CLASS,
} from '@/components/account/mypage-styles'
import { isMyPageTabActive, MYPAGE_TABS } from '@/components/account/mypage-tabs'
import { signOut } from '@/lib/actions/auth-actions'
import { cn } from '@/lib/utils/cn'

const AVATAR_PLACEHOLDER = '/images/mypage/avatar-placeholder.png'

type MyPageSidebarProps = {
  /** 현재 경로. 페이지가 자기 경로를 그대로 넘긴다(클라이언트 훅을 쓰지 않는다). */
  activeHref: string
  nickname: string
  avatarUrl: string | null
}

/**
 * 마이페이지 사이드바(268) — 탭 3개 + 사용자 행.
 *
 * 1280 미만에서는 탭이 가로 줄로 바뀌고 사용자 행이 그 아래에 붙는다(시안 없음).
 * 탭 줄은 좁은 폰에서 가로 스크롤되며, 스크롤 막대는 감춘다.
 *
 * 로그아웃은 링크(GET)가 아니라 폼(POST)이다 — 프리페치·이미지 요청만으로 세션이
 * 끊기는 CSRF 표면을 만들지 않기 위해서다(`LogoutButton` 과 같은 이유).
 */
export function MyPageSidebar({ activeHref, nickname, avatarUrl }: MyPageSidebarProps) {
  return (
    <div className="flex w-full shrink-0 flex-col gap-[10px] xl:w-[268px]">
      <nav aria-label="마이페이지 메뉴">
        <ul className="scrollbar-hidden flex gap-[10px] overflow-x-auto pb-1 xl:flex-col xl:overflow-visible xl:pb-0">
          {MYPAGE_TABS.map((tab) => {
            const isActive = isMyPageTabActive(activeHref, tab.href)

            return (
              <li key={tab.href} className="shrink-0 xl:shrink">
                <Link
                  href={tab.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    MYPAGE_TAB_CLASS,
                    isActive ? MYPAGE_TAB_ACTIVE_CLASS : 'hover:bg-white/60',
                  )}
                >
                  <span className={MYPAGE_TAB_ICON_BOX_CLASS}>
                    <tab.Icon className={tab.fillsBox ? 'text-ink size-12' : 'text-ink'} />
                  </span>
                  <span className={MYPAGE_TAB_LABEL_CLASS}>{tab.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className={cn(MYPAGE_DIVIDER_CLASS, 'flex items-center gap-3 px-[10px] py-6')}>
        {/* 아바타는 임의 외부 호스트(간편로그인 제공자)일 수 있어 next/image 의
            remotePatterns 화이트리스트로는 감당하지 못한다. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl ?? AVATAR_PLACEHOLDER}
          alt=""
          width={40}
          height={40}
          className="size-10 shrink-0 rounded-full object-cover"
        />
        <span className="text-ink truncate text-[17px] leading-[24px]">{nickname}</span>

        <form action={signOut} className="ml-auto">
          <button
            type="submit"
            aria-label="로그아웃"
            className="text-ink focus-visible:outline-focus flex size-10 items-center justify-center rounded-full transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <LogoutGlyph className="size-6" />
          </button>
        </form>
      </div>
    </div>
  )
}
