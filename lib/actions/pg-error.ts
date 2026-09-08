/**
 * PostgREST 오류 코드 판별.
 *
 * 서버 액션은 DB 원문 메시지를 사용자에게 노출하지 않는다(스키마·제약 이름이
 * 그대로 새어 나간다). 대신 코드만 보고 안내 문구를 고른다.
 */

/** unique_violation. 같은 대상을 두 번 신고했을 때 난다. */
export const UNIQUE_VIOLATION = '23505'

/** insufficient_privilege / RLS 위반. */
export const RLS_VIOLATION = '42501'

function readCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null
  }

  const code = (error as { code?: unknown }).code

  return typeof code === 'string' ? code : null
}

export function isUniqueViolation(error: unknown): boolean {
  return readCode(error) === UNIQUE_VIOLATION
}

/**
 * unique_violation 이 어느 제약에서 났는지 이름만 뽑는다.
 *
 * PostgREST 오류 메시지에는 `duplicate key value violates unique constraint
 * "profiles_nickname_key"` 처럼 제약 이름이 그대로 들어 있다. 사용자에게는
 * 절대 원문을 보이지 않지만(스키마 노출), 한 액션이 필드 여러 개에 유니크
 * 제약을 걸어 뒀을 때 "어떤 필드가 겹쳤는지" 분기하는 용도로만 서버 안에서 쓴다.
 */
export function uniqueViolationConstraint(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null
  }

  const message = (error as { message?: unknown }).message

  if (typeof message !== 'string') {
    return null
  }

  return message.match(/constraint "([^"]+)"/)?.[1] ?? null
}

export function isRlsViolation(error: unknown): boolean {
  return readCode(error) === RLS_VIOLATION
}
