import 'server-only'

import { createClient } from '@/lib/supabase/server'

import type { UserRole } from '@/lib/supabase/types'

/**
 * 화면이 쓰는 최소 사용자 정보.
 * 이메일은 헤더·게시판 어디에도 노출하지 않으므로 담지 않는다.
 */
export type CurrentUser = {
  id: string
  nickname: string
  role: UserRole
}

/**
 * 로그인 사용자 + 프로필.
 *
 * 검증에는 `getUser()` 를 쓴다. `getSession()` 은 쿠키의 JWT 를 그대로 신뢰하므로
 * 위조된 쿠키를 통과시킬 수 있어 서버 판단에는 쓰지 않는다.
 *
 * 프로필은 `handle_new_user()` 트리거가 가입 즉시 만들지만, 트리거 실패 같은
 * 예외 상황에서도 헤더가 깨지지 않도록 닉네임은 이메일 앞부분으로 폴백한다.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user === null) {
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname, role')
    .eq('id', user.id)
    .maybeSingle()

  return {
    id: user.id,
    nickname: profile?.nickname ?? (user.email ?? '모험가').split('@')[0] ?? '모험가',
    role: profile?.role ?? 'user',
  }
}
