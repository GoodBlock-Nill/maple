import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { isSocialProvider } from '@/lib/validation/auth'

import type { UserRole } from '@/lib/supabase/types'
import type { SocialProvider } from '@/lib/validation/auth'

/**
 * 화면이 쓰는 최소 사용자 정보.
 * 이메일은 헤더·게시판 어디에도 노출하지 않으므로 담지 않는다.
 */
export type CurrentUser = {
  id: string
  nickname: string
  role: UserRole
  /** 헤더 아바타용. 지금은 스텁 로그인이 채우지 않아 대부분 null — 첫 글자 폴백으로 그린다. */
  avatarUrl: string | null
  /** 헤더 아바타에 브랜드 마크를 그리는 데 쓴다. 모르는 값(레거시 이메일 등)이면 null. */
  provider: SocialProvider | null
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
    .select('nickname, role, avatar_url, provider')
    .eq('id', user.id)
    .maybeSingle()

  return {
    id: user.id,
    nickname: profile?.nickname ?? (user.email ?? '모험가').split('@')[0] ?? '모험가',
    role: profile?.role ?? 'user',
    avatarUrl: profile?.avatar_url ?? null,
    // DB 컬럼은 자유 문자열(string | null)이라 알려진 세 값으로 좁힌다 — 레거시
    // 이메일 계정 등 알 수 없는 값은 헤더에서 중립 폴백(첫 글자)으로 그린다.
    provider: isSocialProvider(profile?.provider) ? profile.provider : null,
  }
}
