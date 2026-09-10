'use server'

import { logFailure } from '@/lib/actions/action-failure'
import { readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import { readMember, revalidateMember, type MemberSnapshot } from '@/lib/actions/member-shared'
import { writeAuditLog } from '@/lib/audit'
import { requirePermission, requireSuperAdmin } from '@/lib/auth/require-admin'
import { CLIENT_CACHE_TAGS, revalidateClient } from '@/lib/revalidate'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { memberLifecycle, purgedNickname } from '@/lib/validation/member-status'
import { forceWithdrawMemberSchema, purgeMemberSchema } from '@/lib/validation/members'

import type { MemberLifecycle } from '@/lib/validation/member-status'

/**
 * 회원 생애주기 조작 — 강제 탈퇴 · 개인정보 즉시 파기.
 *
 * 두 액션 모두 되돌리기 어렵고, 하나(파기)는 아예 되돌릴 수 없다. 서버 액션은 UI 를
 * 거치지 않는 직접 POST 로도 호출되므로 권한 · 자기 자신 · 현재 상태를 **스스로**
 * 전부 확인한다.
 *
 * 상태 전이 규칙은 `docs/admin/ACCOUNT-WITHDRAWAL-PLAN.md` §3, DB 쪽 강제는
 * `supabase/migrations/20260909000400_account_withdrawal.sql` 이다.
 */

const PURGE_FAILURE =
  '개인정보를 파기하지 못했습니다. 계정은 그대로입니다. 잠시 후 다시 시도해 주세요.'

const WITHDRAW_FAILURE =
  '회원을 탈퇴 처리하지 못했습니다. 계정은 그대로입니다. 잠시 후 다시 시도해 주세요.'

const NOT_FOUND = '회원을 찾을 수 없습니다.'

function lifecycleOf(member: MemberSnapshot): MemberLifecycle {
  return memberLifecycle({ deletedAt: member.deleted_at, purgedAt: member.purged_at })
}

/**
 * 개인정보 즉시 파기 — 슈퍼어드민 전용.
 *
 * 90일 배치를 앞당기는 것뿐이라 **결과가 배치와 같아야 한다**. 화면마다 다른 파기가
 * 생기면 게시판의 "탈퇴한 회원" 표시가 갈린다.
 *
 * `public.purge_withdrawn_profiles(p_cutoff)` 는 쓰지 않는다 — 그 함수는 기준 기간을
 * 넘긴 프로필을 **한꺼번에** 훑으므로, 한 명을 지우려고 부르면 아직 기간이 남은
 * 다른 회원까지 함께 파기된다. Edge Function `purge-withdrawn` 도 대상 지정을 받지
 * 않고(크론 secret + 빈 본문) 같은 전량 경로를 부른다. 그래서 이 액션은 서비스 롤로
 * **한 명분만** 같은 필드를 지운다.
 */
export async function purgeMemberNowAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireSuperAdmin()
  const parsed = purgeMemberSchema.safeParse({ memberId: readField(formData, 'memberId') })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { memberId } = parsed.data

  /* 자기 자신은 막는다. 파기는 auth 계정까지 지우므로 진행하는 순간 세션이 끊기고
     되돌릴 수단도 사라진다. */
  if (memberId === actor.id) {
    return { formError: '자기 자신의 개인정보는 이 화면에서 파기할 수 없습니다.' }
  }

  const member = await readMember(memberId)

  if (member === null) {
    return { formError: NOT_FOUND }
  }

  const lifecycle = lifecycleOf(member)

  if (lifecycle === 'purged') {
    return { formError: '이미 개인정보가 파기된 회원입니다. 더 지울 것이 없습니다.' }
  }

  if (lifecycle === 'active') {
    return { formError: '탈퇴하지 않은 회원입니다. 먼저 탈퇴 처리를 한 뒤에 파기할 수 있습니다.' }
  }

  const purgedAt = new Date().toISOString()
  const failure = await purgeProfile(memberId, purgedAt)

  if (failure !== null) {
    return { formError: failure }
  }

  await writeAuditLog(actor.id, {
    action: 'member.purge',
    targetTable: 'profiles',
    targetId: memberId,
    before: {
      nickname: member.nickname,
      email: member.email,
      msw_uid: member.msw_uid,
      msw_profile_code: member.msw_profile_code,
      deleted_at: member.deleted_at,
    },
    after: { nickname: purgedNickname(memberId), purged_at: purgedAt, immediate: true },
  })
  revalidateMember(memberId)
  // 작성자 표시 이름이 바뀌었다. 사용자 사이트 목록이 옛 닉네임을 계속 보이면 안 된다.
  await revalidateClient([CLIENT_CACHE_TAGS.communityList])

  return { message: `${member.nickname} 님의 개인정보를 파기했습니다.` }
}

/**
 * 익명화 + 작성자 스냅샷 갱신 + 로그인 계정 삭제.
 *
 * 지우는 필드는 `purge_withdrawn_profiles()` 와 **한 줄씩 같아야 한다**. 제재까지
 * 비우는 이유는 식별 근거가 사라지기 때문이다(계획 §3 의 5번).
 *
 * `posts.author_name` · `comments.author_name` 도 함께 바꾼다. 공개 조회는 `profiles`
 * 를 읽지 못하므로 그 스냅샷이 화면의 유일한 근거다 — 빠뜨리면 개인정보를 지운 뒤에도
 * 게시판에 옛 닉네임이 남는다.
 *
 * 순서를 바꾸면 안 된다. auth 계정을 먼저 지우면 프로필 행이 함께 사라질 수 있어
 * (FK 는 걷어 냈지만 정리 스크립트가 그 가정 위에 있다) 작성자 연결이 끊긴다.
 * auth 삭제가 깨지면 `purged_at` 을 되돌린다 — 로그인 수단이 남았는데 "파기됨"으로
 * 표시되면 다음 배치가 이 회원을 건너뛰어 이메일이 영영 남는다.
 */
async function purgeProfile(memberId: string, purgedAt: string): Promise<string | null> {
  const service = createAdminClient()
  const nickname = purgedNickname(memberId)

  const { error } = await service
    .from('profiles')
    .update({
      email: null,
      nickname,
      // 이름은 본인이 적은 실명이다. 배치 함수(purge_withdrawn_profiles)와 목록이 같아야 한다.
      name: null,
      avatar_url: null,
      provider_id: null,
      msw_uid: null,
      msw_profile_code: null,
      suspended_until: null,
      suspension_reason: null,
      purged_at: purgedAt,
    })
    .eq('id', memberId)

  if (error !== null) {
    return logFailure('members', PURGE_FAILURE, error)
  }

  await renameAuthorSnapshots(service, memberId, nickname)

  const { error: authError } = await service.auth.admin.deleteUser(memberId)

  if (authError !== null) {
    await service.from('profiles').update({ purged_at: null }).eq('id', memberId)

    return logFailure('members', PURGE_FAILURE, authError)
  }

  return null
}

/**
 * 글·댓글의 작성자 이름 스냅샷 갱신.
 *
 * 실패해도 파기를 되돌리지 않는다. 개인정보(프로필)는 이미 지워졌고, 남는 것은
 * 표시 이름이 늦게 바뀌는 것뿐이다 — 되돌리면 지운 개인정보를 되살릴 수 없어
 * 더 나쁜 상태가 된다. 다음 배치가 같은 갱신을 다시 시도한다.
 */
async function renameAuthorSnapshots(
  service: ReturnType<typeof createAdminClient>,
  memberId: string,
  nickname: string,
): Promise<void> {
  const [posts, comments] = await Promise.all([
    service.from('posts').update({ author_name: nickname }).eq('author_id', memberId),
    service.from('comments').update({ author_name: nickname }).eq('author_id', memberId),
  ])

  for (const result of [posts, comments]) {
    if (result.error !== null) {
      console.error('[members] 작성자 표시 이름을 갱신하지 못했습니다', result.error.message)
    }
  }
}

/**
 * 강제 탈퇴 — 관리자가 회원을 탈퇴 상태로 전환한다.
 *
 * 정지와 다른 조치다. 정지는 쓰기만 막지만 이것은 보존 기간(90일) 시계를 돌린다.
 * 제재는 건드리지 않는다 — 본인이 다시 로그인해 복구하면 남은 제재가 그대로
 * 적용되어야 "탈퇴로 제재를 피한다"는 길이 막힌다.
 *
 * 세션 클라이언트로 쓴다. `profiles_update_admin` 이 관리자에게 다른 회원의 UPDATE 를
 * 열어 주고, `guard_profile_role()` 도 관리자 분기에서 `deleted_at` 을 잠그지 않는다.
 * 서비스 롤을 쓰면 DB 트리거가 남기는 `member.withdraw` 로그의 행위자가 비어(auth.uid()
 * 가 null) 누가 했는지 추적이 끊긴다.
 */
export async function forceWithdrawMemberAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('members', 'write')
  const parsed = forceWithdrawMemberSchema.safeParse({ memberId: readField(formData, 'memberId') })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { memberId } = parsed.data

  if (memberId === actor.id) {
    return { formError: '자기 자신을 탈퇴 처리할 수는 없습니다.' }
  }

  const member = await readMember(memberId)

  if (member === null) {
    return { formError: NOT_FOUND }
  }

  /* 관리자 계정은 `/admins` 의 삭제(콘솔 접근 차단)로 다룬다. 여기서 탈퇴시키면
     역할은 남고 로그인만 막히는 어정쩡한 상태가 된다. */
  if (member.role === 'admin') {
    return {
      formError: '관리자 계정은 탈퇴 처리할 수 없습니다. 먼저 관리자 권한을 회수해 주세요.',
    }
  }

  const lifecycle = lifecycleOf(member)

  if (lifecycle === 'purged') {
    return { formError: '이미 개인정보가 파기된 회원입니다.' }
  }

  if (lifecycle === 'withdrawn') {
    return { formError: '이미 탈퇴 상태인 회원입니다.' }
  }

  const deletedAt = new Date().toISOString()
  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ deleted_at: deletedAt })
    .eq('id', memberId)

  if (error !== null) {
    return { formError: logFailure('members', WITHDRAW_FAILURE, error) }
  }

  await writeAuditLog(actor.id, {
    action: 'member.force_withdraw',
    targetTable: 'profiles',
    targetId: memberId,
    before: { deleted_at: null },
    after: { deleted_at: deletedAt, suspended_until: member.suspended_until },
  })
  revalidateMember(memberId)

  return { message: `${member.nickname} 님을 탈퇴 상태로 전환했습니다.` }
}
