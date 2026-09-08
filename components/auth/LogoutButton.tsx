import { Button } from '@/components/ui/Button'
import { signOut } from '@/lib/actions/auth-actions'

/**
 * 로그아웃 버튼.
 *
 * 링크(GET)가 아니라 폼(POST)으로 만든다. GET 로그아웃은 이미지·프리페치 같은
 * 외부 요청만으로도 세션이 끊기는 CSRF 표면이 된다. 서버 액션은 POST 로만
 * 호출되므로(Next 16 문서) 이 구조가 안전하다.
 */
export function LogoutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="light" size="sm" className="font-medium">
        로그아웃
      </Button>
    </form>
  )
}
