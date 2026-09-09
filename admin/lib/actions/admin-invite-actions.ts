'use server'

import { revalidatePath } from 'next/cache'

import { actionFailure } from '@/lib/actions/action-failure'
import { ADMINS_PATH, INVITE_TTL_MS } from '@/lib/actions/admin-shared'
import { readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import { writeAuditLog } from '@/lib/audit'
import { requireSuperAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { adminSiteUrl } from '@/lib/supabase/env'
import { createClient } from '@/lib/supabase/server'
import { inviteAdminSchema } from '@/lib/validation/admins'

/**
 * 관리자 초대 — 발송 · 재발송 · 취소.
 *
 * 초대만이 관리자를 만드는 경로다(2026-09-09 제품 결정). 회원을 승격하는 화면은
 * 없앴다. 순서는 반드시 **초대 행 → 메일**이다: `inviteUserByEmail()` 이 메일을
 * 보내는 순간 `auth.users` 행이 생기고 `handle_new_user()` 트리거가 돌아 초대 행을
 * 찾기 때문이다. 반대로 하면 초대받은 사람이 일반 사용자로 만들어진다.
 *
 * 모든 액션이 스스로 `requireSuperAdmin()` 을 부른다. 레이아웃이 이미 막고 있어도
 * 서버 액션은 UI 를 거치지 않는 직접 POST 로 호출될 수 있다(Next 문서 경고).
 */

const EXISTING_USER_MESSAGE =
  '이미 계정이 있는 이메일입니다. 관리자 목록에서 역할을 지정하거나 삭제 후 다시 초대해 주세요.'

const SEND_FAILURE_MESSAGE =
  '초대 메일을 보내지 못했습니다. 초대는 취소되었습니다. 주소를 확인하고 다시 시도해 주세요.'

function inviteRedirectTo(): string {
  return `${adminSiteUrl()}/auth/callback?next=${encodeURIComponent('/invite/accept')}`
}

function expiresAt(): string {
  return new Date(Date.now() + INVITE_TTL_MS).toISOString()
}

export async function inviteAdminAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireSuperAdmin()
  const parsed = inviteAdminSchema.safeParse({
    email: readField(formData, 'email'),
    roleId: readField(formData, 'roleId'),
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { email, roleId } = parsed.data
  const supabase = await createClient()

  const { data: role } = await supabase
    .from('admin_roles')
    .select('id, key, name')
    .eq('id', roleId)
    .maybeSingle()

  if (role === null) {
    return { fieldErrors: { roleId: '역할을 찾을 수 없습니다.' } }
  }

  /* 이미 계정이 있으면 조용히 승격하지 않는다. 승격은 "초대를 수락했다"는 사실이
     없는 권한 부여라, 나중에 그 사람이 어떻게 관리자가 됐는지 설명할 수 없다. */
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .maybeSingle()

  if (existing !== null) {
    return { formError: EXISTING_USER_MESSAGE }
  }

  const inviteId = await upsertPendingInvite(email, roleId, actor.id)

  if (inviteId === null) {
    return actionFailure(
      'admins',
      '초대를 기록하지 못했습니다. 메일은 보내지 않았습니다. 다시 시도해 주세요.',
      null,
    )
  }

  const service = createAdminClient()
  const { error } = await service.auth.admin.inviteUserByEmail(email, {
    redirectTo: inviteRedirectTo(),
  })

  if (error !== null) {
    // 메일이 나가지 않은 초대 행을 남기면 그 주소로 가입하는 누구나 관리자가 된다.
    await supabase.from('admin_invites').update({ status: 'revoked' }).eq('id', inviteId)

    return actionFailure('admins', SEND_FAILURE_MESSAGE, error)
  }

  await writeAuditLog(actor.id, {
    action: 'admin.invite',
    targetTable: 'admin_invites',
    targetId: inviteId,
    after: { email, role: role.key },
  })

  revalidatePath(ADMINS_PATH)

  return { message: `${email} 으로 초대 메일을 보냈습니다.` }
}

/**
 * 재발송.
 *
 * Supabase 는 초대 상태(미확인)인 사용자에게 `inviteUserByEmail()` 을 다시 부르면
 * 새 링크로 메일을 다시 보낸다. 허용 목록의 수명도 함께 연장한다 — 링크만 새로
 * 오고 초대가 만료돼 있으면 트리거가 승격을 거른다.
 */
export async function resendInviteAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireSuperAdmin()
  const inviteId = readField(formData, 'inviteId')

  if (inviteId === '') {
    return { formError: '초대를 찾을 수 없습니다.' }
  }

  const supabase = await createClient()
  const { data: invite } = await supabase
    .from('admin_invites')
    .select('id, email, status')
    .eq('id', inviteId)
    .maybeSingle()

  if (invite === null || invite.status !== 'pending') {
    return { formError: '이미 수락되었거나 취소된 초대입니다.' }
  }

  await supabase.from('admin_invites').update({ expires_at: expiresAt() }).eq('id', invite.id)

  const service = createAdminClient()
  const { error } = await service.auth.admin.inviteUserByEmail(invite.email, {
    redirectTo: inviteRedirectTo(),
  })

  if (error !== null) {
    return actionFailure(
      'admins',
      '초대 메일을 다시 보내지 못했습니다. 잠시 후 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'admin.invite.resend',
    targetTable: 'admin_invites',
    targetId: invite.id,
    after: { email: invite.email },
  })

  revalidatePath(ADMINS_PATH)

  return { message: `${invite.email} 으로 초대 메일을 다시 보냈습니다.` }
}

export async function revokeInviteAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireSuperAdmin()
  const inviteId = readField(formData, 'inviteId')

  if (inviteId === '') {
    return { formError: '초대를 찾을 수 없습니다.' }
  }

  const supabase = await createClient()
  const { data: invite } = await supabase
    .from('admin_invites')
    .select('id, email, status')
    .eq('id', inviteId)
    .maybeSingle()

  if (invite === null || invite.status !== 'pending') {
    return { formError: '이미 수락되었거나 취소된 초대입니다.' }
  }

  const { error } = await supabase
    .from('admin_invites')
    .update({ status: 'revoked' })
    .eq('id', invite.id)

  if (error !== null) {
    return actionFailure('admins', '초대를 취소하지 못했습니다. 다시 시도해 주세요.', error)
  }

  await writeAuditLog(actor.id, {
    action: 'admin.invite.revoke',
    targetTable: 'admin_invites',
    targetId: invite.id,
    before: { email: invite.email, status: 'pending' },
    after: { status: 'revoked' },
  })

  revalidatePath(ADMINS_PATH)

  return { message: `${invite.email} 초대를 취소했습니다.` }
}

/**
 * 같은 이메일의 초대 행을 pending 으로 되살리거나 새로 만든다.
 *
 * `upsert` 는 쓸 수 없다 — 유니크 인덱스가 `lower(email)` 이라는 **식**이라
 * `on conflict (email)` 과 맞지 않는다.
 */
async function upsertPendingInvite(
  email: string,
  roleId: string,
  actorId: string,
): Promise<string | null> {
  const supabase = await createClient()
  const row = {
    email,
    role_id: roleId,
    invited_by: actorId,
    status: 'pending',
    accepted_at: null,
    expires_at: expiresAt(),
  }

  const { data: existing } = await supabase
    .from('admin_invites')
    .select('id')
    .ilike('email', email)
    .maybeSingle()

  if (existing !== null) {
    const { error } = await supabase.from('admin_invites').update(row).eq('id', existing.id)

    return error === null ? existing.id : null
  }

  const { data, error } = await supabase.from('admin_invites').insert(row).select('id').single()

  return error === null && data !== null ? data.id : null
}
