import type { UserRole } from '@/lib/supabase/types'

/** `profiles.role` 값. DB enum(user_role)과 항상 같은 집합을 유지해야 한다. */
export const USER_ROLES = ['user', 'admin'] as const satisfies readonly UserRole[]

export const ADMIN_ROLE = 'admin' satisfies UserRole

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)
}

/**
 * 관리자 판정의 단일 출처.
 *
 * 이 함수는 **화면 분기용**이다. 실제 권한은 DB 의 RLS(`public.is_admin()`)가 강제하며,
 * 클라이언트 판정을 우회해도 데이터에는 접근할 수 없다.
 */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === ADMIN_ROLE
}
