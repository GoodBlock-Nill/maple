import { AdminShell } from '@/components/layout/AdminShell'
import { requireAdmin } from '@/lib/auth/require-admin'

/**
 * 관리자 영역의 인가 경계.
 *
 * 레이아웃은 하위 모든 세그먼트보다 먼저 렌더되므로, 여기서 한 번 막으면 2단계에서
 * 어떤 페이지가 추가돼도 인증되지 않은 렌더가 발생하지 않는다. 그래도 각 서버
 * 액션은 자기 몫으로 `requireAdmin()` 을 다시 불러야 한다 — 액션은 레이아웃을
 * 거치지 않고 직접 POST 될 수 있다.
 */
export default async function AdminLayout({ children }: LayoutProps<'/'>) {
  const admin = await requireAdmin()

  return <AdminShell admin={admin}>{children}</AdminShell>
}
