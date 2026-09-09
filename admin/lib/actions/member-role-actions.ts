'use server'

import { revalidatePath } from 'next/cache'

import { actionFailure } from '@/lib/actions/action-failure'
import { revokeAdminAction } from '@/lib/actions/admin-actions'
import { readMember, revalidateMember } from '@/lib/actions/member-shared'
import {
  EMPTY_FORM_STATE,
  readField,
  toFieldErrors,
  type FormState,
} from '@/lib/actions/form-state'
import { writeAuditLog } from '@/lib/audit'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'
import { changeRoleSchema } from '@/lib/validation/members'

/* 관리자 권한 부여 · 회수. 회수는 `/admins` 의 기존 액션을 재사용한다(초대 허용
   목록 정리까지 함께 한다). 부여는 `admin_invites` 에 accepted 행을 먼저 남긴다 —
   README §3 "승격의 유일한 근거는 admin_invites" 를 화면이 늘어도 지키기 위해서다. */
export async function changeMemberRoleAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireAdmin()
  const parsed = changeRoleSchema.safeParse({
    memberId: readField(formData, 'memberId'),
    role: readField(formData, 'role'),
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { memberId, role } = parsed.data

  if (memberId === actor.id) {
    return { formError: '자기 자신의 권한은 바꿀 수 없습니다.' }
  }

  if (role === 'user') {
    const delegated = new FormData()
    delegated.set('adminId', memberId)

    const result = await revokeAdminAction(EMPTY_FORM_STATE, delegated)
    revalidateMember(memberId)

    return result
  }

  const member = await readMember(memberId)

  if (member === null) {
    return { formError: '회원을 찾을 수 없습니다.' }
  }

  if (member.role === 'admin') {
    return { formError: '이미 관리자입니다.' }
  }

  if (member.email === null || member.email === '') {
    return { formError: '이메일이 없는 계정은 관리자로 승격할 수 없습니다(초대 기록 불가).' }
  }

  const inviteError = await recordAcceptedInvite(member.email, actor.id)

  if (inviteError !== null) {
    /* 승격의 유일한 근거가 admin_invites 다. 근거 없이 role 만 올리면 감사가 끊긴다. */
    return actionFailure(
      'members',
      '권한 부여 기록을 남기지 못해 중단했습니다. 권한은 바뀌지 않았습니다. 개발팀에 알려 주세요.',
      inviteError,
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.from('profiles').update({ role: 'admin' }).eq('id', memberId)

  if (error !== null) {
    return actionFailure(
      'members',
      '관리자 권한을 부여하지 못했습니다. 권한은 바뀌지 않았습니다. 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'member.role.grant',
    targetTable: 'profiles',
    targetId: memberId,
    before: { role: 'user' },
    after: { role: 'admin', email: member.email },
  })
  revalidateMember(memberId)
  revalidatePath('/admins')

  return { message: `${member.nickname} 님에게 관리자 권한을 부여했습니다.` }
}

/* 승격 근거가 되는 `admin_invites` 행을 accepted 로 남긴다. `upsert` 는 쓸 수 없다 —
   유니크 인덱스가 `lower(email)` 이라는 **식**이라 `on conflict (email)` 과 안 맞는다. */
async function recordAcceptedInvite(email: string, actorId: string): Promise<string | null> {
  const supabase = await createClient()
  const row = {
    email,
    invited_by: actorId,
    status: 'accepted',
    accepted_at: new Date().toISOString(),
  }
  const { data: existing } = await supabase
    .from('admin_invites')
    .select('id')
    .ilike('email', email)
    .maybeSingle()

  const { error } =
    existing === null || existing === undefined
      ? await supabase.from('admin_invites').insert(row)
      : await supabase.from('admin_invites').update(row).eq('id', existing.id)

  return error === null ? null : error.message
}
