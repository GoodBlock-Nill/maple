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

export function isRlsViolation(error: unknown): boolean {
  return readCode(error) === RLS_VIOLATION
}
