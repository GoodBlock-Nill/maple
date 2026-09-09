import 'server-only'

import { createClient } from '@/lib/supabase/server'

export type AdminListItem = {
  id: string
  email: string
  nickname: string
  createdAt: string
}

/**
 * 관리자 목록.
 *
 * 서비스 롤이 아니라 세션 클라이언트로 읽는다. `profiles_select_admin` 정책이
 * 관리자에게만 전체 조회를 열어 두므로, 권한이 사라지면 목록도 함께 비어야
 * 정상이다 — 서비스 롤로 읽으면 그 검증이 통째로 사라진다.
 */
export async function getAdmins(): Promise<readonly AdminListItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, nickname, created_at')
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
  }))
}
