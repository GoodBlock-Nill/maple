'use server'

import { revalidatePath } from 'next/cache'

import { readField, type FormState } from '@/lib/actions/form-state'
import { writeAuditLog } from '@/lib/audit'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'

/**
 * 관리자 권한 회수. (이메일 초대는 2026-09-09 제품 결정으로 제거 — 승격은
 * 회원 상세의 `changeMemberRoleAction` 한 곳에서만 한다.)
 *
 * 모든 액션이 스스로 `requireAdmin()` 을 부른다. 레이아웃이 이미 막고 있어도
 * 서버 액션은 UI 를 거치지 않는 직접 POST 로 호출될 수 있기 때문이다(Next 문서 경고).
 */

const ADMINS_PATH = '/admins'

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

async function revokeInviteByEmail(email: string | null): Promise<void> {
  if (email === null || email === '') {
    return
  }

  const supabase = await createClient()
  await supabase.from('admin_invites').update({ status: 'revoked' }).ilike('email', email)
}
