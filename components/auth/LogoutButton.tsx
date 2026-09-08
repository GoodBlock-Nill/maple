import { Button } from '@/components/ui/Button'
import { signOut } from '@/lib/actions/auth-actions'

import type { ButtonSize, ButtonVariant } from '@/components/ui/Button'

type LogoutButtonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

/**
 * 로그아웃 버튼.
 *
 * 링크(GET)가 아니라 폼(POST)으로 만든다. GET 로그아웃은 이미지·프리페치 같은
 * 외부 요청만으로도 세션이 끊기는 CSRF 표면이 된다. 서버 액션은 POST 로만
 * 호출되므로(Next 16 문서) 이 구조가 안전하다.
 *
 * 헤더/드로어의 드롭다운 메뉴 항목은 폼 제출을 그대로 재현하되(같은 이유로
 * POST 를 쓴다) 메뉴 항목 표면에 맞춰 직접 그린다 — 이 컴포넌트는 "내 정보"
 * 화면의 독립된 보조 버튼처럼, 필 모양 버튼으로 보여야 하는 자리에서만 쓴다.
 */
export function LogoutButton({ variant = 'light', size = 'sm', className }: LogoutButtonProps) {
  return (
    <form action={signOut}>
      <Button type="submit" variant={variant} size={size} className={className ?? 'font-medium'}>
        로그아웃
      </Button>
    </form>
  )
}
