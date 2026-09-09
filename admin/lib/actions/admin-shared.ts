import 'server-only'

/** `/admins` 관련 액션이 공유하는 상수. 세 파일이 같은 값을 보게 한 곳에 둔다. */

export const ADMINS_PATH = '/admins'

/**
 * 초대 허용 목록의 수명(7일).
 *
 * Supabase 초대 링크 자체의 수명(기본 24시간)과는 다른 개념이다. 이쪽은 "이 주소로
 * 가입하면 관리자가 된다"는 근거의 수명이라, 링크가 만료된 뒤에도 재발송만으로
 * 이어갈 수 있게 조금 길게 잡는다.
 */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * 삭제된 관리자의 로그인 차단 기간(100년).
 *
 * Supabase Auth 의 `ban_duration` 은 기간만 받는다(영구 차단 플래그가 없다).
 * 계정을 지우지 않는 이유는 그 사람이 쓴 뉴스·답변의 작성자 참조가 통째로 끊기기
 * 때문이다 — 이력은 남기고 문만 잠근다.
 */
export const PERMANENT_BAN_DURATION = '876600h'
