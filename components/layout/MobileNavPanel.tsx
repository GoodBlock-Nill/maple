'use client'

import Link from 'next/link'

import { AUTH_PILL_LIGHT_CLASS } from '@/components/layout/AuthMenu'
import { Logo } from '@/components/layout/Logo'
import { MobileNavAccount } from '@/components/layout/MobileNavAccount'
import { isNavItemComingSoon, isNavItemHidden, matchesPath } from '@/components/layout/navigation'
import { Button } from '@/components/ui/Button'
import { ArrowUpRightIcon, CloseIcon } from '@/components/ui/icons'
import { DISCORD_URL, NAV_ITEMS, PLAY_URL } from '@/lib/constants/site'
import { cn } from '@/lib/utils/cn'

import type { MobileNavUser } from '@/components/layout/MobileNav'

/** 상단 바 닫기 버튼 — 트리거(햄버거) 버튼과 같은 히트 영역 규칙을 쓴다. */
const ICON_BUTTON_CLASS =
  'inline-flex size-11 items-center justify-center rounded-bar text-ink transition-colors ' +
  'hover:bg-ink/8 focus-visible:outline-2 focus-visible:outline-offset-2'

/** GNB·하단 바로가기 행 공통 — 행 48 · padding-x 20 · Inter Medium 16/22(시안 §드로어 골격). */
const ROW_TEXT_CLASS = 'font-ui text-[16px] leading-[22px] font-medium tracking-[-0.4px]'

type MobileNavPanelProps = {
  pathname: string
  user: MobileNavUser | null
  /** 드로어가 열려 있는지 — 계정 아코디언 초기화 기준으로 `MobileNavAccount` 에 그대로 넘긴다. */
  isOpen: boolean
  close: () => void
}

/**
 * 드로어 안쪽 마크업(시안 모바일 드로어 v2). 열림/포털/포커스 트랩 등 상태는
 * `MobileNav` 가 갖고, 이 컴포넌트는 렌더링만 맡는다.
 */
export function MobileNavPanel({ pathname, user, isOpen, close }: MobileNavPanelProps) {
  return (
    <>
      <div className="border-line-soft flex h-14 shrink-0 items-center justify-between border-b px-4">
        <Logo width={66} height={24} />
        <button type="button" aria-label="메뉴 닫기" onClick={close} className={ICON_BUTTON_CLASS}>
          <CloseIcon className="size-6" strokeWidth={1.5} />
        </button>
      </div>

      {/* 상단 바 아래 gap 12(시안 §드로어 골격). */}
      <div className="pt-3">
        {user === null ? (
          <div className="border-line-soft flex h-12 items-center border-b px-5 pb-4">
            <Button
              href="/login"
              variant="light"
              size="sm"
              className={cn(AUTH_PILL_LIGHT_CLASS, 'h-10 w-full')}
            >
              로그인
            </Button>
          </div>
        ) : (
          <MobileNavAccount user={user} isDrawerOpen={isOpen} close={close} />
        )}
      </div>

      <nav aria-label="모바일 메뉴" className="flex-1 overflow-y-auto pt-4">
        <ul className="flex flex-col">
          {NAV_ITEMS.filter((item) => !isNavItemHidden(item.href)).map((item) => {
            const isActive = matchesPath(item.href, pathname)
            const isComingSoon = isNavItemComingSoon(item.href)

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  /* 현재 페이지 링크는 경로가 바뀌지 않아 자동으로 닫히지 않으므로 직접 닫는다. */
                  onClick={close}
                  className={cn(
                    'flex h-12 items-center px-5 transition-colors',
                    ROW_TEXT_CLASS,
                    isActive
                      ? 'bg-[#f6f7fa] text-[#e8308a]'
                      : isComingSoon
                        ? 'text-ink-muted'
                        : 'text-ink',
                  )}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-line-soft mt-auto border-t pt-3 pb-8">
        <Link
          href={PLAY_URL}
          prefetch={false}
          onClick={close}
          className={cn(
            'text-ink-muted flex h-12 items-center justify-between px-5',
            ROW_TEXT_CLASS,
          )}
        >
          메이플 월드 바로가기
          <ArrowUpRightIcon className="size-6" />
        </Link>
        <Link
          href={DISCORD_URL}
          prefetch={false}
          onClick={close}
          className={cn(
            'text-ink-muted flex h-12 items-center justify-between px-5',
            ROW_TEXT_CLASS,
          )}
        >
          디스코드 바로가기
          <ArrowUpRightIcon className="size-6" />
        </Link>
      </div>
    </>
  )
}
