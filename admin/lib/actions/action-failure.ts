import type { FormState } from '@/lib/actions/form-state'

/**
 * 실패를 "서버 로그"와 "운영자 문구"로 나누는 한 곳.
 *
 * Supabase·Postgres 의 원문 메시지는 영어인 데다 컬럼명·정책명·제약명을 그대로
 * 흘린다. 운영자는 그것으로 할 수 있는 일이 없고, 화면에 스키마가 드러나는 것은
 * 그 자체로 정보 노출이다. 그래서 원문은 `console.error` 로만 남기고 화면에는
 * **다음 행동이 적힌 고정 문장**을 돌려준다.
 *
 * 예외는 운영자가 스스로 고칠 수 있는 제약 위반뿐이다(유니크 23505 → "이미 있는
 * 닉네임입니다"). 그런 번역은 각 액션이 코드(`error.code`)를 보고 직접 한다.
 */

type ErrorLike = { message?: string } | string | null | undefined

/** 로그에 실을 원인 문자열. 값이 없으면 그 사실을 남긴다(빈 줄이 남으면 추적이 끊긴다). */
function detailOf(error: ErrorLike): string {
  if (typeof error === 'string') {
    return error
  }

  if (error === null || error === undefined) {
    return '(원인 미상)'
  }

  return error.message ?? '(메시지 없음)'
}

/**
 * 원인을 로그에 남기고 **운영자에게 보일 문구만** 돌려준다.
 *
 * `string | null` 을 돌려주는 내부 헬퍼(`suspendMember` · `applyStatusChange` …)용이다.
 * 폼 결과가 필요하면 `actionFailure()` 를 쓴다.
 *
 * @param scope 로그 접두사에 쓰는 도메인. 예: `'settings'` · `'members'`.
 * @param message 화면에 그대로 나갈 한국어 문장.
 */
export function logFailure(scope: string, message: string, error: ErrorLike): string {
  console.error(`[${scope}] ${message}`, detailOf(error))

  return message
}

/** `logFailure()` 의 폼 결과판. 서버 액션의 `return` 자리에 그대로 쓴다. */
export function actionFailure(scope: string, message: string, error: ErrorLike): FormState {
  return { formError: logFailure(scope, message, error) }
}
