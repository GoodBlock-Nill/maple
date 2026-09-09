import 'server-only'

import { parsePermissions, SUPER_ADMIN_ROLE_KEY } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

import type { ModulePermissions } from '@/lib/auth/permissions'

/**
 * `/admins` 화면의 조회.
 *
 * 서비스 롤이 아니라 세션 클라이언트로 읽는다. `profiles_select_admin` ·
 * `admin_roles_select_admin` 정책이 관리자에게만 열려 있으므로, 권한이 사라지면
 * 목록도 함께 비어야 정상이다 — 서비스 롤로 읽으면 그 검증이 통째로 사라진다.
 */

export type AdminListItem = {
  id: string
  email: string
  nickname: string
  createdAt: string
  roleId: string | null
  roleKey: string | null
  roleName: string | null
  isSuperAdmin: boolean
}

export type AdminRoleItem = {
  id: string
  key: string
  name: string
  description: string | null
  permissions: ModulePermissions
  isSystem: boolean
  /** 이 역할을 쓰는 관리자 수. 0 이어야 삭제할 수 있다. */
  memberCount: number
}

export type AdminInviteItem = {
  id: string
  email: string
  roleName: string | null
  createdAt: string
  expiresAt: string | null
  /** 만료된 초대는 링크를 다시 보내야 한다. 목록에서 구분해 보여 준다. */
  isExpired: boolean
}

export async function getAdmins(): Promise<readonly AdminListItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, nickname, created_at, admin_role_id, admin_roles (key, name)')
    .eq('role', 'admin')
    .order('created_at', { ascending: true })

  if (error !== null) {
    console.error('[admins] 목록 조회 실패', error.message)

    return []
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email ?? '-',
    nickname: row.nickname,
    createdAt: row.created_at,
    roleId: row.admin_role_id,
    roleKey: row.admin_roles?.key ?? null,
    roleName: row.admin_roles?.name ?? null,
    isSuperAdmin: row.admin_roles?.key === SUPER_ADMIN_ROLE_KEY,
  }))
}

/**
 * 역할 목록 + 사용 중인 관리자 수.
 *
 * 멤버 수를 별도 질의로 세는 이유: PostgREST 의 임베드 집계(`profiles(count)`)는
 * 역방향 관계에서 필터를 걸 수 없어 `role='user'` 인 잔여 참조까지 함께 센다.
 * 목록이 열 몇 개짜리라 두 번 읽는 비용이 문제가 되지 않는다.
 */
export async function getAdminRoles(): Promise<readonly AdminRoleItem[]> {
  const supabase = await createClient()
  const [{ data: roles, error }, counts] = await Promise.all([
    supabase
      .from('admin_roles')
      .select('id, key, name, description, permissions, is_system')
      .order('is_system', { ascending: false })
      .order('created_at', { ascending: true }),
    countRoleMembers(),
  ])

  if (error !== null) {
    console.error('[admins] 역할 조회 실패', error.message)

    return []
  }

  return (roles ?? []).map((row) => ({
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    permissions: parsePermissions(row.permissions),
    isSystem: row.is_system,
    memberCount: counts.get(row.id) ?? 0,
  }))
}

async function countRoleMembers(): Promise<Map<string, number>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('admin_role_id')
    .eq('role', 'admin')
    .not('admin_role_id', 'is', null)

  const counts = new Map<string, number>()

  for (const row of data ?? []) {
    if (row.admin_role_id !== null) {
      counts.set(row.admin_role_id, (counts.get(row.admin_role_id) ?? 0) + 1)
    }
  }

  return counts
}

/** 아직 수락하지 않은 초대. 만료된 것도 보여 준다 — 재발송 대상이기 때문이다. */
export async function getPendingInvites(): Promise<readonly AdminInviteItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('admin_invites')
    .select('id, email, created_at, expires_at, admin_roles (name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error !== null) {
    console.error('[admins] 초대 목록 조회 실패', error.message)

    return []
  }

  const now = Date.now()

  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    roleName: row.admin_roles?.name ?? null,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    isExpired: row.expires_at !== null && Date.parse(row.expires_at) <= now,
  }))
}

/**
 * 슈퍼어드민 인원수.
 *
 * "마지막 슈퍼어드민을 내리거나 지울 수 없다"는 규칙의 근거다. 이 수가 1 이면
 * 역할 변경·삭제가 막힌다 — 0 이 되는 순간 권한 체계를 되돌릴 사람이 사라지고,
 * 복구에는 서비스 롤 스크립트가 필요해진다.
 */
export async function countSuperAdmins(): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, admin_roles!inner (key)')
    .eq('role', 'admin')
    .eq('admin_roles.key', SUPER_ADMIN_ROLE_KEY)

  return (data ?? []).length
}
