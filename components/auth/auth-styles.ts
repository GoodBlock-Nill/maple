/**
 * 인증 폼이 공유하는 표면.
 * 고객지원 문의 폼·커뮤니티 글쓰기와 같은 입력 표면(h44 · radius 10 · #cdd3db)을 쓴다.
 */
export const AUTH_FIELD_CLASS =
  'rounded-[10px] border-line-soft text-[17px] placeholder:text-[#9a9a9a]'

/** 글래스 카드. 헤더 바(.glass)와 같은 유리 표면에 패널 라운드를 씌운다. */
export const AUTH_CARD_CLASS = 'glass rounded-panel w-full px-6 py-8 sm:px-10 sm:py-10'

export const AUTH_LINK_CLASS =
  'tap-area text-ink underline underline-offset-4 transition-opacity hover:opacity-70'

/**
 * 인증 라우트 핸들러가 실패를 알릴 때 붙이는 `?error=` 값.
 *
 * 원문 오류는 절대 그대로 싣지 않는다(제공자 응답에 토큰·계정 정보가 섞인다).
 * 알 수 없는 코드는 `undefined` 가 되어 아무것도 그리지 않는다.
 */
export const AUTH_ERROR_MESSAGE: Record<string, string | undefined> = {
  provider_not_configured: '아직 준비 중인 로그인 방식입니다.',
  oauth_failed: '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  email_required: '이메일 제공에 동의해 주세요. 이메일이 없으면 가입할 수 없습니다.',
  state_mismatch: '로그인 요청이 만료되었습니다. 처음부터 다시 시도해 주세요.',
  missing_code: '인증 정보가 없어 로그인을 완료하지 못했습니다. 다시 시도해 주세요.',
  auth_failed: '인증에 실패했습니다. 다시 로그인해 주세요.',
  invalid_link: '메일 링크가 올바르지 않습니다. 다시 요청해 주세요.',
  link_expired: '메일 링크가 만료되었습니다. 다시 요청해 주세요.',
}
