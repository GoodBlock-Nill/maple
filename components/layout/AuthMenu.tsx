import { UserMenu } from '@/components/layout/UserMenu'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import { RESTORE_PATH } from '@/lib/validation/auth'

import type { SocialProvider } from '@/lib/validation/auth'

/** 시안 실측: padding 12 · Inter Medium 16 · 자간 -0.2 · 그림자 0 6 5 rgba(0,0,0,.15). */
const AUTH_PILL_BASE = 'font-ui px-3 font-medium tracking-[-0.2px]'
const AUTH_PILL_LIGHT_CLASS = `${AUTH_PILL_BASE} shadow-[inset_0_0_9px_#ddd,0_6px_5px_rgba(0,0,0,0.15)]`
const AUTH_PILL_DARK_CLASS = `${AUTH_PILL_BASE} shadow-[inset_0_0_14px_rgba(255,255,255,0.5),0_6px_5px_rgba(0,0,0,0.15)]`

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
 * 로그인 상태에는 "로그아웃" 버튼을 바로 노출하지 않는다. 닉네임 트리거를
 * 눌러야 열리는 드롭다운(`UserMenu`) 안에 "내 정보"와 함께 둔다 — 제품 결정
 * 2026-09-08(오탐 클릭으로 인한 실수 로그아웃 방지).
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
        <UserMenu nickname={user.nickname} avatarUrl={user.avatarUrl} provider={user.provider} />
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
