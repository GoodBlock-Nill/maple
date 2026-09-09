import 'server-only'

import { createClient } from '@/lib/supabase/server'

import type { Profile } from '@/lib/supabase/types'

/**
 * "내 정보" 화면이 필요로 하는 프로필 조회.
 *
 * `lib/auth/current-user.ts` 는 헤더용으로 닉네임 중심의 최소 모양만 돌려준다.
 * 내 정보 화면은 로그인 방식·가입일·약관 동의 일시까지 함께 보여줘야 해서
 * 별도 컬럼 세트를 읽는 이 모듈을 둔다.
 *
 * DB 스네이크케이스 컬럼명을 그대로 쓴다 — `isOnboardingComplete()`
 * (lib/validation/auth.ts) 가 같은 모양(`OnboardingStatusSource`)을 기대하므로,
 * 여기서 캐멀케이스로 바꾸면 호출부마다 다시 변환해야 한다.
 */
export type AccountProfile = Pick<
  Profile,
  | 'nickname'
  | 'provider'
  | 'avatar_url'
  | 'created_at'
  | 'terms_agreed_at'
  | 'privacy_agreed_at'
  | 'age_confirmed_at'
  | 'msw_uid'
  | 'msw_profile_code'
  | 'deleted_at'
  | 'purged_at'
>

/* prettier-ignore — 한 줄 리터럴이어야 supabase-js 가 select 결과 타입을 추론한다. */
const ACCOUNT_COLUMNS =
  'nickname, provider, avatar_url, created_at, terms_agreed_at, privacy_agreed_at, age_confirmed_at, msw_uid, msw_profile_code, deleted_at, purged_at'

/** 프로필이 없으면(트리거 실패 등) null. 호출부가 온보딩 미완료로 취급한다. */
export async function getAccountProfile(userId: string): Promise<AccountProfile | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select(ACCOUNT_COLUMNS)
    .eq('id', userId)
    .maybeSingle()

  return data
}
