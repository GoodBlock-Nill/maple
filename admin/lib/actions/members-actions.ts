'use server'

import { revalidatePath } from 'next/cache'

import { revokeAdminAction } from '@/lib/actions/admin-actions'
import { EMPTY_FORM_STATE, readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import { writeAuditLog } from '@/lib/audit'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'
import {
  changeNicknameSchema,
  changeRoleSchema,
  suspendMemberSchema,
  suspensionUntil,
  unsuspendMemberSchema,
} from '@/lib/validation/members'

import type { Tables } from '@/lib/supabase/types'
import type { SuspensionPeriod } from '@/lib/validation/members'

/* 회원 제재 · 프로필 강제 변경 · 권한. 쓰기는 세션 클라이언트로 한다 —
   `profiles_update_admin` 이 관리자에게 다른 회원의 UPDATE 를 열어 두므로 서비스
   롤이 필요 없다. 서비스 롤을 일반 경로에 쓰면 권한 버그가 조용히 통과한다. */

const MEMBERS_PATH = '/members'

/** 닉네임에는 `lower(nickname)` 유니크 인덱스가 있다. 중복은 이 코드로 돌아온다. */
const UNIQUE_VIOLATION = '23505'

function revalidateMember(id: string): void {
  revalidatePath(MEMBERS_PATH)
  revalidatePath(`${MEMBERS_PATH}/${id}`)
}

/* 액션 내부 스냅샷이라 컬럼명을 그대로 쓴다 — 감사 로그의 before 와 표기가 같아진다. */
type MemberSnapshot = Pick<
  Tables<'profiles'>,
  'id' | 'nickname' | 'email' | 'role' | 'suspended_until' | 'suspension_reason'
>

async function readMember(id: string): Promise<MemberSnapshot | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, nickname, email, role, suspended_until, suspension_reason')
    .eq('id', id)
    .maybeSingle()

  return data
}

/* 정지 적용(실패 시 사용자에게 보일 메시지 반환). 신고 처리도 같은 경로를 쓴다.
   `'use server'` 의 export 는 전부 액션 엔드포인트라 행위자를 인자로 받지 않는다. */
export async function suspendMember(
  memberId: string,
  period: SuspensionPeriod,
  reason: string,
): Promise<string | null> {
  const actor = await requireAdmin()

  if (memberId === actor.id) {
    return '자기 자신을 정지할 수는 없습니다.'
  }

  const member = await readMember(memberId)

  if (member === null) {
    return '회원을 찾을 수 없습니다.'
  }

  // 관리자에게는 제재가 안 걸린다(`not is_suspended()` 는 일반 사용자 정책에만 있다).
  if (member.role === 'admin') {
    return '관리자 계정은 정지할 수 없습니다. 먼저 관리자 권한을 회수해 주세요.'
  }

  const until = suspensionUntil(period)
  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ suspended_until: until, suspension_reason: reason })
    .eq('id', memberId)

  if (error !== null) {
    return `정지에 실패했습니다. ${error.message}`
  }

  await writeAuditLog(actor.id, {
    action: 'member.suspend',
    targetTable: 'profiles',
    targetId: memberId,
    before: { suspended_until: member.suspended_until, suspension_reason: member.suspension_reason },
    after: { suspended_until: until, suspension_reason: reason, period },
  })
  revalidateMember(memberId)

  return null
}

export async function suspendMemberAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = suspendMemberSchema.safeParse({
    memberId: readField(formData, 'memberId'),
    period: readField(formData, 'period'),
    reason: readField(formData, 'reason'),
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const error = await suspendMember(parsed.data.memberId, parsed.data.period, parsed.data.reason)

  return error === null ? { message: '회원을 정지했습니다.' } : { formError: error }
}

export async function unsuspendMemberAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireAdmin()
  const parsed = unsuspendMemberSchema.safeParse({ memberId: readField(formData, 'memberId') })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { memberId } = parsed.data
  const member = await readMember(memberId)

  if (member === null) {
    return { formError: '회원을 찾을 수 없습니다.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ suspended_until: null, suspension_reason: null })
    .eq('id', memberId)

  if (error !== null) {
    return { formError: `정지 해제에 실패했습니다. ${error.message}` }
  }

  await writeAuditLog(actor.id, {
    action: 'member.unsuspend',
    targetTable: 'profiles',
    targetId: memberId,
    before: { suspended_until: member.suspended_until, suspension_reason: member.suspension_reason },
    after: { suspended_until: null, suspension_reason: null },
  })
  revalidateMember(memberId)

  return { message: `${member.nickname} 님의 정지를 해제했습니다.` }
}

/* 닉네임 강제 변경. 사유를 필수로 받는다 — 남의 표시 이름을 바꾸는 조치라
   근거가 없으면 나중에 항의가 들어왔을 때 확인할 방법이 없다. */
export async function changeNicknameAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireAdmin()
  const parsed = changeNicknameSchema.safeParse({
    memberId: readField(formData, 'memberId'),
    nickname: readField(formData, 'nickname'),
    reason: readField(formData, 'reason'),
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { memberId, nickname, reason } = parsed.data
  const member = await readMember(memberId)

  if (member === null) {
    return { formError: '회원을 찾을 수 없습니다.' }
  }

  if (member.nickname === nickname) {
    return { fieldErrors: { nickname: '지금과 같은 닉네임입니다.' } }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('profiles').update({ nickname }).eq('id', memberId)

  if (error?.code === UNIQUE_VIOLATION) {
    return { fieldErrors: { nickname: '이미 사용 중인 닉네임입니다.' } }
  }

  if (error !== null) {
    return { formError: `닉네임을 바꾸지 못했습니다. ${error.message}` }
  }

  // posts/comments 의 author_name 은 작성 시점 스냅샷이라 건드리지 않는다.
  await writeAuditLog(actor.id, {
    action: 'member.nickname.force_change',
    targetTable: 'profiles',
    targetId: memberId,
    before: { nickname: member.nickname },
    after: { nickname, reason },
  })
  revalidateMember(memberId)

  return { message: `닉네임을 ${nickname} 로 변경했습니다.` }
}

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
    return { formError: `초대 기록을 남기지 못했습니다. ${inviteError}` }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('profiles').update({ role: 'admin' }).eq('id', memberId)

  if (error !== null) {
    return { formError: `권한을 부여하지 못했습니다. ${error.message}` }
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
  const row = { email, invited_by: actorId, status: 'accepted', accepted_at: new Date().toISOString() }
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
