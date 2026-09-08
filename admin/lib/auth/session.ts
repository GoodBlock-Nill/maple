/**
 * 30분 비활동 만료.
 *
 * Supabase 의 리프레시 토큰은 며칠씩 살아 있어서 브라우저를 켜 둔 채 자리를 비우면
 * 세션이 그대로 남는다. 관리자 화면은 그 상태가 곧 위험이므로 "마지막 요청 시각"을
 * 쿠키에 적고, 30분이 지난 요청은 프록시에서 로그아웃시킨다.
 *
 * 이 쿠키는 **보안 경계가 아니라 편의 장치**다. 지우면 타이머가 초기화되지만, 지울
 * 수 있는 쪽은 이미 인증 쿠키를 쥐고 있는 브라우저뿐이라 새로 얻는 권한이 없다.
 * 진짜 만료는 Supabase 세션 수명이 강제한다.
 *
 * 순수 함수만 둔다 — 프록시(요청 앞단)와 단위 테스트가 함께 쓴다.
 */

export const LAST_SEEN_COOKIE = 'admin_last_seen'

/** 비활동 허용 시간(밀리초). PLAN.md §2 의 "세션 만료 30분 비활동". */
export const INACTIVITY_LIMIT_MS = 30 * 60 * 1000

export type LastSeenCookie = {
  name: typeof LAST_SEEN_COOKIE
  value: string
  options: {
    httpOnly: true
    sameSite: 'lax'
    secure: boolean
    path: '/'
    maxAge: number
  }
}

/**
 * 마지막 활동 이후 30분이 지났는가.
 *
 * 값이 없거나 숫자가 아니면 `false` 를 돌려준다. 로그인 직후 첫 요청에는 쿠키가
 * 없는데, 여기서 만료로 판정하면 로그인하자마자 튕겨 나가 로그인 자체가 불가능해진다.
 */
export function isInactive(lastSeen: string | undefined, now: number): boolean {
  if (lastSeen === undefined || lastSeen.trim() === '') {
    return false
  }

  const stamp = Number.parseInt(lastSeen, 10)

  if (!Number.isFinite(stamp) || stamp <= 0) {
    return false
  }

  return now - stamp > INACTIVITY_LIMIT_MS
}

/** 이번 요청 시각을 담은 쿠키. 매 요청마다 갱신되어 타이머가 뒤로 밀린다. */
export function buildLastSeenCookie(now: number, isSecure: boolean): LastSeenCookie {
  return {
    name: LAST_SEEN_COOKIE,
    value: String(now),
    options: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecure,
      path: '/',
      maxAge: Math.floor(INACTIVITY_LIMIT_MS / 1000),
    },
  }
}
