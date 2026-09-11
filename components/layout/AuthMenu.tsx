import { AccountMenu } from '@/components/layout/AccountMenu'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import { RESTORE_PATH } from '@/lib/validation/auth'

import type { SocialProvider } from '@/lib/validation/auth'

/**
 * 로그아웃 상태의 "로그인" 알약 표면(시안 auth-v2 §공통 실측).
 * padding 12 · Inter Medium 16 · 자간 -0.2 · inset 0 0 9 #ddd · drop 0 6 5 rgba(0,0,0,.15).
 *
 * 폰 헤더(SiteHeader)의 알약도 시안에서 같은 흰 알약이라 이 값을 함께 쓴다.
 */
export const AUTH_PILL_LIGHT_CLASS =
  'font-ui px-3 font-medium tracking-[-0.2px] shadow-[inset_0_0_9px_#ddd,0_6px_5px_rgba(0,0,0,0.15)]'

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
 * 미로그인일 때는 "로그인" 알약 **하나**다. 로그인 수단이 간편로그인뿐이라
 * 가입과 로그인이 같은 동작이 되었기 때문이다(로그인 시안 auth-v2 §공통).
 * 실측: h40 · padding 12 · radius 50 · Inter Medium 16 · border #cdd3db.
 *
 * 로그인 상태는 마이페이지 v2 시안(§1)의 계정 메뉴다 — 제공자 아이콘 + 닉네임 +
 * 삼각형, 누르면 "마이페이지 / 로그아웃" 드롭다운이 열린다(`AccountMenu`).
 * v1 의 어두운 알약과 사이드바 로그아웃은 함께 사라졌다.
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
        <AccountMenu nickname={user.nickname} avatarUrl={user.avatarUrl} provider={user.provider} />
      </div>
    )
  }

  return (
    /* 컨테이너 그림자(0 2 2 rgba(0,0,0,.25))는 시안 실측값이다. */
    <div id={id} className={cn('items-center drop-shadow-[0_2px_2px_rgba(0,0,0,0.25)]', className)}>
      {/* 시안 헤더 인증 버튼만 Inter Medium 16 이다(히어로 CTA 는 Switzer Semibold). */}
      <Button href="/login" variant="light" size="sm" className={AUTH_PILL_LIGHT_CLASS}>
        로그인
      </Button>
    </div>
  )
}
