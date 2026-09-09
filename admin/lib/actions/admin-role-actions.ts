'use server'

import { revalidatePath } from 'next/cache'

import { actionFailure } from '@/lib/actions/action-failure'
import { ADMINS_PATH } from '@/lib/actions/admin-shared'
import { readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import { writeAuditLog } from '@/lib/audit'
import { requireSuperAdmin } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'
import {
  createRoleSchema,
  permissionMatrixSchema,
  readPermissionFields,
  updateRoleSchema,
} from '@/lib/validation/admins'

import type { ModulePermissions } from '@/lib/auth/permissions'
import type { Json } from '@/types/database.types'

/**
 * 관리자 권한(역할) CRUD — 슈퍼어드민 전용.
 *
 * DB 도 같은 규칙을 강제한다(`admin_roles_*_super` 정책 + `guard_admin_roles` 트리거).
 * 앱에서만 막으면 REST 로 직접 부르는 요청이 그대로 통과한다.
 *
 * `key` 는 만든 뒤 바꾸지 않는다. 시스템 역할 판정과 감사 로그가 key 를 근거로
 * 삼으므로, 바꿀 수 있게 두면 이미 남은 이력이 다른 역할을 가리키게 된다.
 */

const DUPLICATE_KEY_CODE = '23505'

export async function createAdminRoleAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireSuperAdmin()
  const parsed = createRoleSchema.safeParse({
    key: readField(formData, 'key'),
    name: readField(formData, 'name'),
    description: readField(formData, 'description'),
  })
  const permissions = permissionMatrixSchema.safeParse(readPermissionFields(formData))

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  if (!permissions.success) {
    return { formError: '권한 값이 올바르지 않습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('admin_roles')
    .insert({
      key: parsed.data.key,
      name: parsed.data.name,
      description: emptyToNull(parsed.data.description),
      permissions: permissions.data as Json,
    })
    .select('id')
    .single()

  if (error !== null) {
    if (error.code === DUPLICATE_KEY_CODE) {
      return { fieldErrors: { key: '이미 사용 중인 키입니다.' } }
    }

    return actionFailure('admins', '역할을 만들지 못했습니다. 다시 시도해 주세요.', error)
  }

  await writeAuditLog(actor.id, {
    action: 'admin.role.create',
    targetTable: 'admin_roles',
    targetId: data.id,
    after: { key: parsed.data.key, permissions: permissions.data as Json },
  })

  revalidatePath(ADMINS_PATH)

  return { message: `${parsed.data.name} 역할을 만들었습니다.` }
}

export async function updateAdminRoleAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireSuperAdmin()
  const parsed = updateRoleSchema.safeParse({
    roleId: readField(formData, 'roleId'),
    name: readField(formData, 'name'),
    description: readField(formData, 'description'),
  })
  const permissions = permissionMatrixSchema.safeParse(readPermissionFields(formData))

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  if (!permissions.success) {
    return { formError: '권한 값이 올바르지 않습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.' }
  }

  const role = await readRole(parsed.data.roleId)

  if (role === null) {
    return { formError: '역할을 찾을 수 없습니다.' }
  }

  if (role.isSystem) {
    return { formError: '시스템 역할은 수정할 수 없습니다.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('admin_roles')
    .update({
      name: parsed.data.name,
      description: emptyToNull(parsed.data.description),
      permissions: permissions.data as Json,
    })
    .eq('id', role.id)

  if (error !== null) {
    return actionFailure('admins', '역할을 저장하지 못했습니다. 다시 시도해 주세요.', error)
  }

  await writeAuditLog(actor.id, {
    action: 'admin.role.update',
    targetTable: 'admin_roles',
    targetId: role.id,
    before: { permissions: role.permissions as Json },
    after: { permissions: permissions.data as Json },
  })

  revalidatePath(ADMINS_PATH)

  return { message: `${parsed.data.name} 역할을 저장했습니다.` }
}

/**
 * 역할 삭제.
 *
 * 쓰는 사람이 있으면 막는다. FK 가 `on delete set null` 이라 지워도 오류는 나지
 * 않지만, 그 순간 그 관리자들은 아무 화면도 못 보는 상태가 된다 — 조용한 사고다.
 */
export async function deleteAdminRoleAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireSuperAdmin()
  const roleId = readField(formData, 'roleId')

  if (roleId === '') {
    return { formError: '역할을 찾을 수 없습니다.' }
  }

  const role = await readRole(roleId)

  if (role === null) {
    return { formError: '역할을 찾을 수 없습니다.' }
  }

  if (role.isSystem) {
    return { formError: '시스템 역할은 삭제할 수 없습니다.' }
  }

  const memberCount = await countMembers(role.id)

  if (memberCount > 0) {
    return {
      formError: `이 역할을 쓰는 관리자가 ${memberCount}명 있습니다. 먼저 다른 역할로 바꿔 주세요.`,
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('admin_roles').delete().eq('id', role.id)

  if (error !== null) {
    return actionFailure('admins', '역할을 삭제하지 못했습니다. 다시 시도해 주세요.', error)
  }

  await writeAuditLog(actor.id, {
    action: 'admin.role.delete',
    targetTable: 'admin_roles',
    targetId: role.id,
    before: { key: role.key, name: role.name },
  })

  revalidatePath(ADMINS_PATH)

  return { message: `${role.name} 역할을 삭제했습니다.` }
}

type RoleRow = {
  id: string
  key: string
  name: string
  isSystem: boolean
  permissions: ModulePermissions
}

async function readRole(roleId: string): Promise<RoleRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('admin_roles')
    .select('id, key, name, is_system, permissions')
    .eq('id', roleId)
    .maybeSingle()

  if (data === null) {
    return null
  }

  return {
    id: data.id,
    key: data.key,
    name: data.name,
    isSystem: data.is_system,
    permissions: (data.permissions ?? {}) as ModulePermissions,
  }
}

async function countMembers(roleId: string): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('admin_role_id', roleId)

  return count ?? 0
}

function emptyToNull(value: string): string | null {
  return value === '' ? null : value
}
