'use server'

import { revalidatePath } from 'next/cache'

import { actionFailure } from '@/lib/actions/action-failure'
import { ADMINS_PATH, PERMANENT_BAN_DURATION } from '@/lib/actions/admin-shared'
import { toFieldErrors, readField, type FormState } from '@/lib/actions/form-state'
import { writeAuditLog } from '@/lib/audit'
import { SUPER_ADMIN_ROLE_KEY } from '@/lib/auth/permissions'
import { requireSuperAdmin } from '@/lib/auth/require-admin'
import { countSuperAdmins } from '@/lib/data/admins'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { changeAdminRoleSchema, deleteAdminSchema } from '@/lib/validation/admins'

/**
 * 관리자 계정 관리 — 역할 변경 · 삭제.
 *
 * 둘 다 슈퍼어드민 전용이다. `admins` 모듈 권한과 별개로 두는 이유는
 * `require-admin.ts` 의 `requireSuperAdmin()` 주석에 있다.
 *
 * 두 가지 안전장치가 항상 함께 걸린다.
 *   * 자기 자신은 바꾸거나 지울 수 없다 — 실수로 스스로를 잠그면 복구에 서비스 롤
 *     스크립트가 필요하다.
 *   * 마지막 슈퍼어드민은 내리거나 지울 수 없다 — 0 이 되는 순간 권한 체계를
 *     되돌릴 사람이 사라진다.
 */

const SELF_MESSAGE = '자기 자신의 권한은 바꿀 수 없습니다.'
const LAST_SUPER_ADMIN_MESSAGE = '마지막 슈퍼어드민입니다. 다른 슈퍼어드민을 먼저 지정해 주세요.'

type AdminTarget = {
  id: string
  email: string | null
  nickname: string
  roleId: string | null
  roleKey: string | null
}

export async function changeAdminRoleAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireSuperAdmin()
  const parsed = changeAdminRoleSchema.safeParse({
    adminId: readField(formData, 'adminId'),
    roleId: readField(formData, 'roleId'),
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { adminId, roleId } = parsed.data

  if (adminId === actor.id) {
    return { formError: SELF_MESSAGE }
  }

  const target = await readAdmin(adminId)

  if (target === null) {
    return { formError: '관리자를 찾을 수 없습니다.' }
  }

  if (target.roleId === roleId) {
    return { formError: '이미 같은 역할입니다.' }
  }

  const supabase = await createClient()
  const { data: role } = await supabase
    .from('admin_roles')
    .select('id, key, name')
    .eq('id', roleId)
    .maybeSingle()

  if (role === null) {
    return { formError: '역할을 찾을 수 없습니다.' }
  }

  if (await wouldDropLastSuperAdmin(target, role.key)) {
    return { formError: LAST_SUPER_ADMIN_MESSAGE }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ admin_role_id: roleId })
    .eq('id', adminId)

  if (error !== null) {
    return actionFailure(
      'admins',
      '역할을 바꾸지 못했습니다. 권한은 그대로입니다. 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'admin.role.change',
    targetTable: 'profiles',
    targetId: adminId,
    before: { role: target.roleKey },
    after: { role: role.key },
  })

  revalidatePath(ADMINS_PATH)

  return { message: `${target.nickname} 님의 역할을 ${role.name} 로 바꿨습니다.` }
}

/**
 * 관리자 삭제 = **콘솔 접근 차단**.
 *
 * 계정 행을 지우지 않는다. `profiles.role` 을 내리고 역할을 비운 뒤, 서비스 롤로
 * auth 사용자를 정지시킨다 — 여기까지 해야 이메일·비밀번호로도 다시 들어올 수
 * 없다(role 만 내리면 로그인은 성공하고 화면에서만 튕긴다).
 */
export async function deleteAdminAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireSuperAdmin()
  const parsed = deleteAdminSchema.safeParse({ adminId: readField(formData, 'adminId') })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { adminId } = parsed.data

  if (adminId === actor.id) {
    return { formError: '자기 자신은 삭제할 수 없습니다.' }
  }

  const target = await readAdmin(adminId)

  if (target === null) {
    return { formError: '관리자를 찾을 수 없습니다.' }
  }

  if (target.roleKey === SUPER_ADMIN_ROLE_KEY && (await countSuperAdmins()) <= 1) {
    return { formError: LAST_SUPER_ADMIN_MESSAGE }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ role: 'user', admin_role_id: null })
    .eq('id', adminId)

  if (error !== null) {
    return actionFailure(
      'admins',
      '관리자를 삭제하지 못했습니다. 권한은 그대로입니다. 다시 시도해 주세요.',
      error,
    )
  }

  // 허용 목록에서도 내린다. 남겨 두면 같은 주소로 재가입할 때 다시 관리자가 된다.
  await revokeInvitesFor(target.email)
  await banAuthUser(adminId)

  await writeAuditLog(actor.id, {
    action: 'admin.delete',
    targetTable: 'profiles',
    targetId: adminId,
    before: { role: 'admin', adminRole: target.roleKey },
    after: { role: 'user', banned: true },
  })

  revalidatePath(ADMINS_PATH)

  return { message: `${target.nickname} 관리자를 삭제했습니다.` }
}

async function readAdmin(adminId: string): Promise<AdminTarget | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, email, nickname, role, admin_role_id, admin_roles (key)')
    .eq('id', adminId)
    .maybeSingle()

  if (data === null || data.role !== 'admin') {
    return null
  }

  return {
    id: data.id,
    email: data.email,
    nickname: data.nickname,
    roleId: data.admin_role_id,
    roleKey: data.admin_roles?.key ?? null,
  }
}

/** 슈퍼어드민을 다른 역할로 내릴 때, 그 사람이 마지막 한 명인지. */
async function wouldDropLastSuperAdmin(target: AdminTarget, nextRoleKey: string): Promise<boolean> {
  if (target.roleKey !== SUPER_ADMIN_ROLE_KEY || nextRoleKey === SUPER_ADMIN_ROLE_KEY) {
    return false
  }

  return (await countSuperAdmins()) <= 1
}

async function revokeInvitesFor(email: string | null): Promise<void> {
  if (email === null || email === '') {
    return
  }

  const supabase = await createClient()
  await supabase.from('admin_invites').update({ status: 'revoked' }).ilike('email', email)
}

/**
 * 로그인 자체를 막는다. 실패해도 삭제를 되돌리지 않는다 — role 은 이미 내려갔고,
 * 되돌리면 "지웠는데 관리자로 남아 있는" 더 나쁜 상태가 된다. 로그만 남긴다.
 */
async function banAuthUser(userId: string): Promise<void> {
  const service = createAdminClient()
  const { error } = await service.auth.admin.updateUserById(userId, {
    ban_duration: PERMANENT_BAN_DURATION,
  })

  if (error !== null) {
    console.error('[admins] 계정 차단 실패(권한은 이미 회수됨)', error.message)
  }
}
