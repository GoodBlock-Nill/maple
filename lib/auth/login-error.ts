/**
 * 로그인 화면의 `?error=` → 오류 행 문구.
 *
 * 인증 라우트 핸들러(`/auth/callback` · `/auth/confirm`)와 프록시는 실패를
 * 쿼리스트링 한 낱말로만 알린다 — 제공자 응답에는 토큰·계정 정보가 섞여 있어
 * 원문을 그대로 실을 수 없다.
 *
 * 시안(auth-v2 §PC 오류 행)의 기본 문구는 하나뿐이지만, 원인이 분명해서
 * 사용자가 다음 행동을 고를 수 있는 경우에만 더 구체적인 문장을 쓴다.
 * 모르는 값은 기본 문구로 눌러 담는다 — 빈 화면보다 낫고, 내부 코드가 그대로
 * 노출되지도 않는다.
 */

/** 시안 문구. 마침표 없이 끝나는 것까지 시안 그대로다. */
export const LOGIN_FAILURE_MESSAGE = '로그인에 실패했어요. 잠시 후 다시 시도해주세요'

const SPECIFIC_MESSAGE: Record<string, string | undefined> = {
  provider_not_configured: '아직 준비 중인 로그인 방식입니다.',
  email_required: '이메일 제공에 동의해 주세요. 이메일이 없으면 가입할 수 없습니다.',
  state_mismatch: '로그인 요청이 만료되었습니다. 처음부터 다시 시도해 주세요.',
  missing_code: '인증 정보가 없어 로그인을 완료하지 못했습니다. 다시 시도해 주세요.',
  auth_failed: '인증에 실패했습니다. 다시 로그인해 주세요.',
  invalid_link: '메일 링크가 올바르지 않습니다. 다시 요청해 주세요.',
  link_expired: '메일 링크가 만료되었습니다. 다시 요청해 주세요.',
}

/** 값이 없으면(정상 진입) `undefined` — 오류 행 자체를 그리지 않는다. */
export function loginErrorMessage(key: string | null | undefined): string | undefined {
  if (typeof key !== 'string' || key.trim() === '') {
    return undefined
  }

  return SPECIFIC_MESSAGE[key] ?? LOGIN_FAILURE_MESSAGE
}
