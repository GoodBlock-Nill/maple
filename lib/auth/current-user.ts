import 'server-only'

import { isWithdrawnProfile } from '@/lib/auth/lifecycle'
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
  /**
   * 제재 종료 시각(ISO). null 이면 제재 없음.
   *
   * **본인 값만** 담긴다. `profiles_select_self` 정책이 자기 행만 열어 주므로 이
   * 경로로 남의 제재 상태를 읽을 수는 없다(읽기가 막히면 값은 그냥 null 이 된다).
   */
  suspendedUntil: string | null
  /** 사용자에게 그대로 보여 주는 제재 사유. 내부 메모가 아니다. */
  suspensionReason: string | null
  /** 탈퇴 요청 시각(ISO). null 이면 정상 회원. 90일 안에 복구할 수 있다. */
  deletedAt: string | null
  /** 개인정보 파기 시각(ISO). 있으면 복구할 수 없는 익명화 계정이다. */
  purgedAt: string | null
  /** `deletedAt` 이 있으면 true — 화면은 `/auth/restore` 로 보내고 쓰기를 열지 않는다. */
  isWithdrawn: boolean
  /** 메이플스토리 월드 계정 UID. 글쓰기 월드 연동 필수 플래그의 판정 근거다. */
  mswUid: string | null
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
    .select(
      'nickname, role, avatar_url, provider, suspended_until, suspension_reason, deleted_at, purged_at, msw_uid',
    )
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
    /* 정지 안내(글쓰기 · 댓글 · 신고 · 좋아요)를 그리는 데 쓴다. 프로필을 못 읽었을
       때 null 로 떨어지는 것은 안전한 방향이다 — 제재는 최종적으로 RLS 가 막고,
       액션은 42501 을 같은 안내로 옮겨 적는다. */
    suspendedUntil: profile?.suspended_until ?? null,
    suspensionReason: profile?.suspension_reason ?? null,
    /* 탈퇴 상태도 같은 방향이다 — 못 읽으면 정상으로 보고, 쓰기는 `is_withdrawn()`
       정책이 최종적으로 막는다. */
    deletedAt: profile?.deleted_at ?? null,
    purgedAt: profile?.purged_at ?? null,
    isWithdrawn: isWithdrawnProfile(profile),
    mswUid: profile?.msw_uid ?? null,
  }
}
