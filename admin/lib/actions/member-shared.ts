import 'server-only'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

import type { Tables } from '@/lib/supabase/types'

/**
 * 회원 액션들이 함께 쓰는 조회·무효화.
 *
 * **`'use server'` 를 붙이지 않는다.** 그 지시어가 붙은 모듈의 export 는 전부 액션
 * 엔드포인트로 열리므로, 인가를 스스로 하지 않는 `readMember()` 를 그런 모듈에서
 * 내보내면 아무나 직접 POST 로 남의 이메일·권한을 읽어 갈 수 있다.
 */

export const MEMBERS_PATH = '/members'

/** 닉네임에는 `lower(nickname)` 유니크 인덱스가 있다. 중복은 이 코드로 돌아온다. */
export const UNIQUE_VIOLATION = '23505'

/* 액션 내부 스냅샷이라 컬럼명을 그대로 쓴다 — 감사 로그의 before 와 표기가 같아진다.
   탈퇴·파기 시각까지 함께 읽는다: 제재든 파기든 "지금 어떤 상태인가"를 먼저
   확인해야 하고, 액션마다 다른 질의를 쓰면 같은 회원이 경로에 따라 다르게 보인다. */
export type MemberSnapshot = Pick<
  Tables<'profiles'>,
  | 'id'
  | 'nickname'
  | 'email'
  | 'avatar_url'
  | 'role'
  | 'suspended_until'
  | 'suspension_reason'
  | 'msw_uid'
  | 'msw_profile_code'
  | 'deleted_at'
  | 'purged_at'
>

/* prettier-ignore — 한 줄 리터럴이어야 supabase-js 가 select 결과 타입을 추론한다. */
const MEMBER_SNAPSHOT_COLUMNS =
  'id, nickname, email, avatar_url, role, suspended_until, suspension_reason, msw_uid, msw_profile_code, deleted_at, purged_at'

export function revalidateMember(id: string): void {
  revalidatePath(MEMBERS_PATH)
  revalidatePath(`${MEMBERS_PATH}/${id}`)
}

export async function readMember(id: string): Promise<MemberSnapshot | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select(MEMBER_SNAPSHOT_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  return data
}
