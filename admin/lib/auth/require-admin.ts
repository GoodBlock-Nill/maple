import 'server-only'

import { redirect } from 'next/navigation'

import {
  hasAnyPermission,
  hasPermission,
  parsePermissions,
  SUPER_ADMIN_ROLE_KEY,
  type AdminModule,
  type ModulePermissions,
  type PermissionLevel,
} from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

import type { UserRole } from '@/lib/supabase/types'

/** 관리자 화면이 쓰는 최소 사용자 정보 + 역할(권한). */
export type AdminUser = {
  id: string
  email: string
  nickname: string
  role: UserRole
  /** `admin_roles.key`. 역할이 아직 지정되지 않은 관리자는 `null`. */
  roleKey: string | null
  /** 화면에 그리는 역할 이름(예: '슈퍼어드민'). */
  roleName: string | null
  permissions: ModulePermissions
  isSuperAdmin: boolean
}

const ADMIN_ROLE: UserRole = 'admin'

/** 권한이 없어 대시보드로 되돌릴 때 쓰는 주소. 대시보드가 배너로 사유를 알린다. */
export const FORBIDDEN_REDIRECT = '/?error=forbidden'

/**
 * 관리자 전용 페이지·서버 액션의 진입 가드.
 *
 * 프록시는 "로그인 여부"만 낙관적으로 거른다(문서: proxy 는 세션 관리·인가 전용
 * 해법이 아니다). 실제 인가는 여기와 RLS(`public.is_admin()`) 두 겹으로 강제한다.
 *
 * 검증에 `getUser()` 를 쓰는 이유: `getSession()` 은 쿠키의 JWT 를 그대로 신뢰해
 * 위조 쿠키를 통과시킬 수 있다.
 *
 * 권한이 없으면 **로그아웃까지 시킨다.** 세션만 남겨 두고 돌려보내면 사용자는
 * "로그인은 됐는데 아무것도 못 하는" 상태에 갇히고, 로그인 폼도 이미 로그인된
 * 세션 때문에 혼란스러워진다.
 *
 * 역할(`admin_roles`)은 같은 질의에서 함께 읽는다. 화면마다 다시 조회하면
 * 요청당 왕복이 늘고, 무엇보다 "권한을 읽지 못한 화면"이 생겨 판정이 갈린다.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user === null) {
    redirect('/login?error=session_required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname, role, admin_role_id, admin_roles (key, name, permissions)')
    .eq('id', user.id)
    .maybeSingle()

  if (profile === null || profile.role !== ADMIN_ROLE) {
    await supabase.auth.signOut()
    redirect('/login?error=not_admin')
  }

  /* 역할이 비어 있는 관리자는 "아무 모듈도 못 보는" 상태로 남는다(닫힘 실패).
     기본값을 슈퍼어드민으로 두면 역할 삭제 사고가 곧 권한 상승이 된다. */
  const role = profile.admin_roles

  return {
    id: user.id,
    email: user.email ?? '',
    nickname: profile.nickname,
    role: profile.role,
    roleKey: role?.key ?? null,
    roleName: role?.name ?? null,
    permissions: parsePermissions(role?.permissions),
    isSuperAdmin: role?.key === SUPER_ADMIN_ROLE_KEY,
  }
}

/**
 * 모듈 권한까지 확인하는 가드. 페이지와 쓰기 서버 액션이 첫 줄에 쓴다.
 *
 * 권한이 없으면 **로그아웃시키지 않는다.** 계정 자체는 정상이고 이 화면만 닫혀
 * 있을 뿐이라, 세션을 끊으면 쓸 수 있는 화면까지 함께 잃는다. 대신 대시보드로
 * 되돌리고 거기서 사유를 알린다.
 */
export async function requirePermission(
  module: AdminModule,
  level: PermissionLevel,
): Promise<AdminUser> {
  const admin = await requireAdmin()

  if (!hasPermission(admin.permissions, module, level)) {
    redirect(FORBIDDEN_REDIRECT)
  }

  return admin
}

/**
 * 여러 모듈 중 하나만 충족하면 통과하는 가드.
 *
 * 신고 처리처럼 **두 모듈에 걸친 조치**를 위한 것이다 — 신고를 종결하려면 대상
 * 글을 숨겨야 하는데, 그때마다 커뮤니티 쓰기까지 요구하면 '신고 담당' 역할이
 * 성립하지 않는다.
 */
export async function requireAnyPermission(
  modules: readonly AdminModule[],
  level: PermissionLevel,
): Promise<AdminUser> {
  const admin = await requireAdmin()

  if (!hasAnyPermission(admin.permissions, modules, level)) {
    redirect(FORBIDDEN_REDIRECT)
  }

  return admin
}

/**
 * 슈퍼어드민 전용 가드. 관리자 초대·삭제·역할 관리가 쓴다.
 *
 * `admins` 모듈 권한과 별개다 — 권한 체계 자체를 바꾸는 조작은 역할표로 위임할 수
 * 없다(위임할 수 있으면 임의의 역할이 스스로를 슈퍼어드민으로 올릴 수 있다).
 * DB 쪽에서도 `is_super_admin()` 이 같은 조작을 막는다(두 겹).
 */
export async function requireSuperAdmin(): Promise<AdminUser> {
  const admin = await requireAdmin()

  if (!admin.isSuperAdmin) {
    redirect(FORBIDDEN_REDIRECT)
  }

  return admin
}
