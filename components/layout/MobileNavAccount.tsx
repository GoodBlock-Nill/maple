'use client'

import Link from 'next/link'
import { useState } from 'react'

import { ChevronDownGlyph } from '@/components/account/mypage-icons'
import { MYPAGE_ACCOUNT_PATH } from '@/components/account/mypage-tabs'
import { UserAvatar } from '@/components/layout/UserAvatar'
import { signOut } from '@/lib/actions/auth-actions'
import { cn } from '@/lib/utils/cn'
import { RESTORE_PATH } from '@/lib/validation/auth'

import type { MobileNavUser } from '@/components/layout/MobileNav'

const ACCOUNT_PANEL_ID = 'mobile-nav-account-panel'

/** 하위 행(내 정보·계정 복구·로그아웃) — 40 · padding-left 44(아이콘 폭만큼 들여쓰기) · Inter Medium 14/20. */
const SUB_ROW_CLASS =
  'text-ink font-ui flex h-10 items-center pl-[44px] pr-4 text-left text-[14px] leading-[20px] font-medium'

type MobileNavAccountProps = {
  user: MobileNavUser
  /** 드로어가 닫히면 펼침 상태도 초기화한다(시안 v2 §로그인 — 기본 닫힘). */
  isDrawerOpen: boolean
  close: () => void
}

/**
 * 로그인 상태의 계정 행(시안 v2 §로그인) — 헤더 `AccountMenu` 트리거와 같은 모양
 * (제공자 아이콘 + 닉네임 + 삼각형)이지만, 드롭다운이 아니라 드로어 안에서
 * 접었다 펴는 아코디언이다("내 정보"·"로그아웃"이 드로어를 벗어나면 화면이 좁아
 * 잘리기 때문).
 */
export function MobileNavAccount({ user, isDrawerOpen, close }: MobileNavAccountProps) {
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  /* effect 대신 렌더 중 상태 조정(React 권장 패턴) — 드로어가 닫히는 렌더에서
     곧바로 접어 두면, 다음에 열 때 펼쳐진 채로 깜빡이는 프레임이 없다. */
  const [wasDrawerOpen, setWasDrawerOpen] = useState(isDrawerOpen)

  if (isDrawerOpen !== wasDrawerOpen) {
    setWasDrawerOpen(isDrawerOpen)
    if (!isDrawerOpen) setIsAccountOpen(false)
  }

  return (
    <div className="border-line-soft border-b pb-3">
      <button
        type="button"
        aria-expanded={isAccountOpen}
        aria-controls={ACCOUNT_PANEL_ID}
        onClick={() => setIsAccountOpen((open) => !open)}
        className="flex h-11 w-full items-center px-5 py-3.5"
      >
        <UserAvatar
          nickname={user.nickname}
          avatarUrl={user.avatarUrl}
          provider={user.provider}
          size="lg"
          plateless
        />
        <span className="font-ui text-ink ml-1 truncate text-[16px] leading-[22px] font-medium tracking-[-0.4px]">
          {user.nickname}
        </span>
        <ChevronDownGlyph
          className={cn(
            'text-ink ml-2 h-1.5 w-3 transition-transform',
            isAccountOpen ? '' : 'rotate-180',
          )}
        />
      </button>

      {isAccountOpen ? (
        <div id={ACCOUNT_PANEL_ID}>
          {user.isWithdrawn === true ? (
            <Link href={RESTORE_PATH} onClick={close} className={SUB_ROW_CLASS}>
              계정 복구
            </Link>
          ) : (
            <Link href={MYPAGE_ACCOUNT_PATH} onClick={close} className={SUB_ROW_CLASS}>
              내 정보
            </Link>
          )}
          <form action={signOut}>
            <button type="submit" className={cn(SUB_ROW_CLASS, 'w-full')}>
              로그아웃
            </button>
          </form>
        </div>
      ) : null}
    </div>
  )
}
