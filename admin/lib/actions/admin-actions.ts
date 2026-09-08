'use server'

import { revalidatePath } from 'next/cache'

import { readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import { writeAuditLog } from '@/lib/audit'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { adminSiteUrl } from '@/lib/supabase/env'
import { createClient } from '@/lib/supabase/server'
import { inviteAdminSchema } from '@/lib/validation/auth'

/**
 * 관리자 초대 · 권한 회수.
 *
 * 모든 액션이 스스로 `requireAdmin()` 을 부른다. 레이아웃이 이미 막고 있어도
 * 서버 액션은 UI 를 거치지 않는 직접 POST 로 호출될 수 있기 때문이다(Next 문서 경고).
 */

const ADMINS_PATH = '/admins'

/**
 * 관리자 초대.
 *
 * 순서가 중요하다 — `inviteUserByEmail()` 은 **메일을 보내는 그 순간** auth.users
 * 행을 만들고, 그 insert 가 `handle_new_user()` 트리거를 깨운다. 트리거는
 * `admin_invites` 의 pending 행을 보고 role 을 정하므로, 초대 행이 먼저 들어가
 * 있지 않으면 초대받은 사람이 일반 사용자로 생성된다.
 *
 *   1) admin_invites 에 pending 행 기록  ← 반드시 먼저
 *   2) inviteUserByEmail (서비스 롤)
 *   3) 실패하면 초대 행을 revoked 로 되돌린다
 */
export async function inviteAdminAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireAdmin()
  const parsed = inviteAdminSchema.safeParse({ email: readField(formData, 'email') })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const email = parsed.data.email.toLowerCase()
  const supabase = await createClient()

  const { data: existingAdmin } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('email', email)
    .maybeSingle()

  if (existingAdmin?.role === 'admin') {
    return { formError: '이미 관리자인 계정입니다.' }
  }

  const inviteId = await upsertInvite(email, actor.id)

  if (inviteId === null) {
    return { formError: '초대 기록을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }

  const serviceClient = createAdminClient()
  const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${adminSiteUrl()}/auth/callback?next=/invite/accept`,
  })

  if (error !== null) {
    /* 이미 가입된 이메일이면 트리거가 돌지 않는다. 초대장은 그대로 두고 권한만
       올린 뒤, 본인에게는 비밀번호 재설정으로 들어오라고 안내한다. */
    if (existingAdmin !== null && existingAdmin !== undefined) {
      await promoteExistingUser(existingAdmin.id, inviteId)
      await writeAuditLog(actor.id, {
        action: 'admin.invite.promote_existing',
        targetTable: 'profiles',
        targetId: existingAdmin.id,
        after: { email, role: 'admin' },
      })
      revalidatePath(ADMINS_PATH)

      return {
        message: `${email} 은(는) 이미 가입된 계정이라 관리자 권한만 부여했습니다. 비밀번호 재설정으로 로그인하도록 안내해 주세요.`,
      }
    }

    await revokeInvite(inviteId)

    return { formError: `초대 메일을 보내지 못했습니다. ${error.message}` }
  }

  await writeAuditLog(actor.id, {
    action: 'admin.invite',
    targetTable: 'admin_invites',
    targetId: inviteId,
    after: { email, invited_user_id: data.user?.id ?? null },
  })

  revalidatePath(ADMINS_PATH)

  return { message: `${email} 로 초대 메일을 보냈습니다.` }
}

/**
 * 관리자 권한 회수.
 *
 * 계정을 지우지 않고 role 만 'user' 로 내린다. 지우면 그 사람이 쓴 뉴스·답변의
 * 작성자 참조가 통째로 끊긴다.
 *
 * 자기 자신은 회수할 수 없다. 마지막 관리자가 스스로를 내리면 아무도 들어올 수
 * 없는 상태가 되고, 복구에는 서비스 롤 스크립트가 필요해진다.
 */
export async function revokeAdminAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireAdmin()
  const targetId = readField(formData, 'adminId')

  if (targetId === '') {
    return { formError: '대상을 찾을 수 없습니다.' }
  }

  if (targetId === actor.id) {
    return { formError: '자기 자신의 권한은 회수할 수 없습니다.' }
  }

  const supabase = await createClient()
  const { data: target } = await supabase
    .from('profiles')
    .select('id, email, nickname, role')
    .eq('id', targetId)
    .maybeSingle()

  if (target === null || target.role !== 'admin') {
    return { formError: '이미 관리자가 아닙니다.' }
  }

  const { error } = await supabase.from('profiles').update({ role: 'user' }).eq('id', targetId)

  if (error !== null) {
    return { formError: `권한을 회수하지 못했습니다. ${error.message}` }
  }

  // 허용 목록에서도 내린다. 남겨 두면 같은 이메일로 재가입할 때 다시 관리자가 된다.
  await revokeInviteByEmail(target.email)

  await writeAuditLog(actor.id, {
    action: 'admin.revoke',
    targetTable: 'profiles',
    targetId,
    before: { role: 'admin' },
    after: { role: 'user' },
  })

  revalidatePath(ADMINS_PATH)

  return { message: `${target.nickname} 님의 관리자 권한을 회수했습니다.` }
}

/** 기존 초대가 있으면 pending 으로 되살리고, 없으면 새로 만든다. */
async function upsertInvite(email: string, actorId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('admin_invites')
    .select('id')
    .ilike('email', email)
    .maybeSingle()

  if (existing !== null && existing !== undefined) {
    const { error } = await supabase
      .from('admin_invites')
      .update({ status: 'pending', accepted_at: null, invited_by: actorId })
      .eq('id', existing.id)

    return error === null ? existing.id : null
  }

  const { data, error } = await supabase
    .from('admin_invites')
    .insert({ email, invited_by: actorId, status: 'pending' })
    .select('id')
    .single()

  return error === null ? data.id : null
}

async function revokeInvite(inviteId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('admin_invites').update({ status: 'revoked' }).eq('id', inviteId)
}

async function revokeInviteByEmail(email: string | null): Promise<void> {
  if (email === null || email === '') {
    return
  }

  const supabase = await createClient()
  await supabase.from('admin_invites').update({ status: 'revoked' }).ilike('email', email)
}

/** 이미 가입된 계정을 관리자로 올린다. 트리거가 돌지 않는 경로의 보정. */
async function promoteExistingUser(userId: string, inviteId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('profiles').update({ role: 'admin' }).eq('id', userId)
  await supabase
    .from('admin_invites')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', inviteId)
}
