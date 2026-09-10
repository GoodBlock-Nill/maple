import Link from 'next/link'

import { PersonFillGlyph } from '@/components/account/mypage-icons'
import { MYPAGE_ACCOUNT_PATH } from '@/components/account/mypage-tabs'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import { RESTORE_PATH } from '@/lib/validation/auth'

import type { SocialProvider } from '@/lib/validation/auth'

/** 시안 실측: padding 12 · Inter Medium 16 · 자간 -0.2 · 그림자 0 6 5 rgba(0,0,0,.15). */
const AUTH_PILL_BASE = 'font-ui px-3 font-medium tracking-[-0.2px]'
const AUTH_PILL_LIGHT_CLASS = `${AUTH_PILL_BASE} shadow-[inset_0_0_9px_#ddd,0_6px_5px_rgba(0,0,0,0.15)]`
const AUTH_PILL_DARK_CLASS = `${AUTH_PILL_BASE} shadow-[inset_0_0_14px_rgba(255,255,255,0.5),0_6px_5px_rgba(0,0,0,0.15)]`

/**
 * 로그인 상태의 알약(마이페이지 시안 §2 실측).
 * h40 · radius 50 · bg #2a2a2a · border 1 #000 · padding-left 20 / right 12 · gap 12 ·
 * inset shadow 0 0 14 rgba(255,255,255,.5) + drop shadow 0 6 5 rgba(0,0,0,.15).
 */
const ACCOUNT_PILL_CLASS =
  'bg-ink rounded-pill focus-visible:outline-focus inline-flex h-10 items-center gap-3 border border-black ' +
  'py-0 pr-3 pl-5 transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'shadow-[inset_0_0_14px_rgba(255,255,255,0.5),0_6px_5px_rgba(0,0,0,0.15)]'

type AuthMenuProps = {
  /** 서버에서 `getCurrentUser()` 로 주입한다. 미로그인이면 null. */
  user?: {
    nickname: string
    avatarUrl?: string | null
    provider?: SocialProvider | null
    /** 탈퇴 대기 계정. 정상 로그인 상태(닉네임 메뉴)로 그리지 않고 복구로 안내한다. */
    isWithdrawn?: boolean
  } | null
  id?: string
  className?: string
}

/**
 * 헤더 우측 인증 영역.
 *
 * 미로그인일 때는 버튼 두 개("로그인" 흰색 · "회원가입" 진한색)를 둔다. 이메일
 * 가입이 되살아나면서 두 동작이 서로 다른 화면이 되었다 — 로그인·회원가입 시안
 * (Figma 2041:2294) 실측: h40 · padding 12 · radius 50 · gap 12 · Inter Medium 16.
 *
 * 로그인 상태는 마이페이지 시안(2041:3122)의 어두운 알약 하나다 — 닉네임 +
 * 사람 아이콘, 누르면 `/account`. 드롭다운(내 정보·로그아웃)을 두지 않는 이유는
 * 시안에 없기 때문이고, 로그아웃은 마이페이지 사이드바(그리고 폰 드로어)에 있다.
 * 헤더에서 바로 로그아웃할 수 없게 된 것은 오탐 클릭 방지(2026-09-08 결정)와도
 * 같은 방향이다.
 *
 * 탈퇴 대기 계정(`isWithdrawn`)은 세션은 있지만 회원으로 취급하지 않는다 — 닉네임
 * 메뉴 대신 "계정 복구" 버튼 하나만 둔다(복구 화면에 로그아웃이 함께 있다).
 */
export function AuthMenu({ user = null, id, className }: AuthMenuProps) {
  if (user?.isWithdrawn === true) {
    return (
      <div id={id} className={cn('items-center gap-3', className)}>
        <Button href={RESTORE_PATH} variant="dark" size="sm" className="font-ui font-medium">
          계정 복구
        </Button>
      </div>
    )
  }

  if (user) {
    return (
      <div id={id} className={cn('items-center', className)}>
        <Link href={MYPAGE_ACCOUNT_PATH} className={ACCOUNT_PILL_CLASS}>
          <span className="max-w-[160px] truncate text-[17px] leading-[24px] text-[#fafafa]">
            {user.nickname}
          </span>
          <PersonFillGlyph className="size-6 shrink-0 text-white" />
        </Link>
      </div>
    )
  }

  return (
    /* 컨테이너 그림자(0 2 2 rgba(0,0,0,.25))는 두 버튼에 함께 걸린다 — 시안 실측. */
    <div
      id={id}
      className={cn('items-center gap-3 drop-shadow-[0_2px_2px_rgba(0,0,0,0.25)]', className)}
    >
      {/* 시안 헤더 인증 버튼만 Inter Medium 16 이다(히어로 CTA 는 Switzer Semibold). */}
      <Button href="/login" variant="light" size="sm" className={AUTH_PILL_LIGHT_CLASS}>
        로그인
      </Button>
      <Button href="/signup" variant="dark" size="sm" className={AUTH_PILL_DARK_CLASS}>
        회원가입
      </Button>
    </div>
  )
}
