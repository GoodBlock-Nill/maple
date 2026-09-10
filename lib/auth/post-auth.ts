import { resolvePostAuthDestination } from '@/lib/auth/lifecycle'

import type { TypedSupabaseClient } from '@/lib/supabase/types'

/**
 * 로그인 직후 갈 곳을 고른다.
 *
 * 탈퇴 대기 중(`deleted_at`)이면 복구 화면이 먼저고, 그다음 온보딩(닉네임 확정 +
 * 약관 동의) 미완료면 어디로 가려 했든 온보딩을 먼저 통과시킨다. 규칙 자체는
 * `resolvePostAuthDestination()` 하나가 소유한다(프록시·인증 콜백과 같은 함수).
 *
 * 간편로그인·이메일 로그인·회원가입 완료가 모두 같은 판정을 써야 해서 조회까지
 * 포함한 이 얇은 껍데기를 공유한다.
 */

/* prettier-ignore — 한 줄 리터럴이어야 supabase-js 가 select 결과 타입을 추론한다. */
const GATE_COLUMNS =
  'nickname, terms_agreed_at, privacy_agreed_at, age_confirmed_at, msw_uid, msw_profile_code, deleted_at, purged_at'

export async function resolvePostAuthPath(
  supabase: TypedSupabaseClient,
  userId: string,
  next: string | undefined,
): Promise<string> {
  const { data: profile } = await supabase
    .from('profiles')
    .select(GATE_COLUMNS)
    .eq('id', userId)
    .maybeSingle()

  return resolvePostAuthDestination(profile, next)
}
