import { UserMenu } from '@/components/layout/UserMenu'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import { RESTORE_PATH } from '@/lib/validation/auth'

import type { SocialProvider } from '@/lib/validation/auth'

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
 * 미로그인일 때는 **버튼 하나**(진한 필 "로그인")만 둔다. 간편로그인에는
 * "가입"과 "로그인"의 구분이 없어서(첫 로그인이 곧 가입이다) 두 버튼을 나란히
 * 두면 사용자가 무엇이 다른지 고민하게 된다 — 제품 결정 2026-09-08.
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
    <div id={id} className={cn('items-center gap-3', className)}>
      {/* 시안 헤더 인증 버튼만 Inter Medium 16 이다(히어로 CTA 는 Switzer Semibold). */}
      <Button href="/login" variant="dark" size="sm" className="font-ui font-medium">
        로그인
      </Button>
    </div>
  )
}
