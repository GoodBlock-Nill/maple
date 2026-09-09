'use server'

import { actionFailure, logFailure } from '@/lib/actions/action-failure'
import { readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import { readMember, revalidateMember, UNIQUE_VIOLATION } from '@/lib/actions/member-shared'
import { writeAuditLog } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'
import { josa } from '@/lib/utils/josa'
import {
  changeNicknameSchema,
  suspendMemberSchema,
  suspensionUntil,
  unsuspendMemberSchema,
} from '@/lib/validation/members'

import type { SuspensionPeriod } from '@/lib/validation/members'

/* 회원 제재 · 프로필 강제 변경. 관리자 계정 관리는 `/admins`(admin-actions.ts) 가 맡는다 —
   회원을 승격해 관리자를 만드는 경로는 2026-09-09 제품 결정으로 사라졌다.
   쓰기는 세션 클라이언트로 한다 —
   `profiles_update_admin` 이 관리자에게 다른 회원의 UPDATE 를 열어 두므로 서비스
   롤이 필요 없다. 서비스 롤을 일반 경로에 쓰면 권한 버그가 조용히 통과한다. */

/* 정지 적용(실패 시 사용자에게 보일 메시지 반환). 신고 처리도 같은 경로를 쓴다.
   `'use server'` 의 export 는 전부 액션 엔드포인트라 행위자를 인자로 받지 않는다. */
export async function suspendMember(
  memberId: string,
  period: SuspensionPeriod,
  reason: string,
): Promise<string | null> {
  const actor = await requirePermission('members', 'write')

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

  /* 파기된 계정에는 걸 것이 없다. 로그인 수단이 사라졌고 식별 근거도 없어
     (계획 §3 의 5번) 제재를 남겨 두면 다음 파기 배치가 다시 지운다. */
  if (member.purged_at !== null) {
    return '개인정보가 파기된 계정입니다. 제재를 적용할 대상이 없습니다.'
  }

  const until = suspensionUntil(period)
  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ suspended_until: until, suspension_reason: reason })
    .eq('id', memberId)

  if (error !== null) {
    return logFailure(
      'members',
      '회원을 정지하지 못했습니다. 정지는 적용되지 않았습니다. 잠시 후 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'member.suspend',
    targetTable: 'profiles',
    targetId: memberId,
    before: {
      suspended_until: member.suspended_until,
      suspension_reason: member.suspension_reason,
    },
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
  const actor = await requirePermission('members', 'write')
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
    return actionFailure(
      'members',
      '정지를 해제하지 못했습니다. 정지는 그대로입니다. 잠시 후 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'member.unsuspend',
    targetTable: 'profiles',
    targetId: memberId,
    before: {
      suspended_until: member.suspended_until,
      suspension_reason: member.suspension_reason,
    },
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
  const actor = await requirePermission('members', 'write')
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
    return actionFailure(
      'members',
      '닉네임을 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.',
      error,
    )
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

  return { message: `닉네임을 ${nickname}${josa(nickname, '로')} 변경했습니다.` }
}
