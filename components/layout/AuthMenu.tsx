import { LogoutButton } from '@/components/auth/LogoutButton'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

type AuthMenuProps = {
  /** 서버에서 `getCurrentUser()` 로 주입한다. 미로그인이면 null. */
  user?: { nickname: string } | null
  id?: string
  className?: string
}

/**
 * 헤더 우측 인증 영역.
 *
 * 미로그인일 때는 **버튼 하나**(진한 필 "로그인")만 둔다. 간편로그인에는
 * "가입"과 "로그인"의 구분이 없어서(첫 로그인이 곧 가입이다) 두 버튼을 나란히
 * 두면 사용자가 무엇이 다른지 고민하게 된다 — 제품 결정 2026-09-08.
 */
export function AuthMenu({ user = null, id, className }: AuthMenuProps) {
  if (user) {
    return (
      <div id={id} className={cn('items-center gap-3', className)}>
        <span className="text-ink-muted hidden text-[15px] sm:inline">
          <strong className="text-ink font-semibold">{user.nickname}</strong>님
        </span>
        <LogoutButton />
      </div>
    )
  }

  return (
    <div id={id} className={cn('items-center gap-3', className)}>
      <Button href="/login" variant="dark" size="sm">
        로그인
      </Button>
    </div>
  )
}
