/**
 * 환경 변수 접근 헬퍼.
 *
 * `process.env.X` 를 그대로 넘기고 이름을 함께 받는 이유:
 * Next.js 는 `NEXT_PUBLIC_*` 을 **정적 문자열 치환**으로 인라인하므로
 * `process.env[name]` 같은 동적 접근은 번들에서 undefined 가 된다.
 * 따라서 호출부가 리터럴로 읽고, 이 함수는 검증만 담당한다.
 */
export function requireEnv(name: string, value: string | undefined): string {
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `환경 변수 ${name} 가 비어 있습니다. admin/.env.example 을 참고해 admin/.env.local 을 채워 주세요.`,
    )
  }

  return value
}

/** 값이 없어도 되는 환경 변수. 빈 문자열은 "설정하지 않음"으로 취급한다. */
export function optionalEnv(value: string | undefined): string | null {
  if (value === undefined || value.trim() === '') {
    return null
  }

  return value
}

/** 초대·비밀번호 재설정 메일의 `redirectTo` 기준이 되는 관리자 사이트 URL. */
export function adminSiteUrl(): string {
  return (
    optionalEnv(process.env.NEXT_PUBLIC_ADMIN_URL)?.replace(/\/+$/, '') ?? 'http://localhost:3100'
  )
}

/** 게시글·문의 "원문 보기" 링크가 가리키는 사용자 사이트 URL. */
export function clientSiteUrl(): string {
  return (
    optionalEnv(process.env.NEXT_PUBLIC_CLIENT_SITE_URL)?.replace(/\/+$/, '') ??
    'http://localhost:3000'
  )
}
