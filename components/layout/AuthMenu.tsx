import { LogoutButton } from '@/components/auth/LogoutButton'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

type AuthMenuProps = {
  /** 서버에서 `getCurrentUser()` 로 주입한다. 미로그인이면 null. */
  user?: { nickname: string } | null
  id?: string
  className?: string
}

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
      <Button href="/login" variant="light" size="sm" className="font-medium">
        로그인
      </Button>
      <Button href="/register" variant="dark" size="sm">
        회원가입
      </Button>
    </div>
  )
}
