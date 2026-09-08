import 'server-only'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

import type { UserRole } from '@/lib/supabase/types'

/** 관리자 화면이 쓰는 최소 사용자 정보. */
export type AdminUser = {
  id: string
  email: string
  nickname: string
  role: UserRole
}

const ADMIN_ROLE: UserRole = 'admin'

/**
 * 관리자 전용 페이지·서버 액션의 진입 가드.
 *
 * 프록시는 "로그인 여부"만 낙관적으로 거른다(문서: proxy 는 세션 관리·인가 전용
 * 해법이 아니다). 실제 인가는 여기와 RLS(`public.is_admin()`) 두 겹으로 강제한다.
 *
 * 검증에 `getUser()` 를 쓰는 이유: `getSession()` 은 쿠키의 JWT 를 그대로 신뢰해
 * 위조 쿠키를 통과시킬 수 있다.
 *
 * 권한이 없으면 **로그아웃까지 시킨다.** 세션만 남겨 두고 돌려보내면 사용자는
 * "로그인은 됐는데 아무것도 못 하는" 상태에 갇히고, 로그인 폼도 이미 로그인된
 * 세션 때문에 혼란스러워진다.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user === null) {
    redirect('/login?error=session_required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname, role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile === null || profile.role !== ADMIN_ROLE) {
    await supabase.auth.signOut()
    redirect('/login?error=not_admin')
  }

  return {
    id: user.id,
    email: user.email ?? '',
    nickname: profile.nickname,
    role: profile.role,
  }
}
