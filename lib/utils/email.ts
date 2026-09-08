import { domainToASCII, domainToUnicode } from 'node:url'

/**
 * 이메일 주소의 **표기형**과 **링크형** 변환.
 *
 * 글자월드 연락처는 한글 도메인(`contact@글자월드.co.kr`)이다. 시안은 한글
 * 그대로 보여 주지만, `mailto:` href 에 한글을 그대로 넣으면 일부 메일
 * 클라이언트가 주소를 열지 못한다. 그래서 화면에는 유니코드(IDN), href 에는
 * ASCII(Punycode) 를 쓴다.
 *
 * 관리자(`site_settings.contact_email`)가 둘 중 **어느 형태로 저장하든** 화면과
 * 링크가 같아야 하므로, 저장값을 그대로 쓰지 않고 항상 이 두 함수를 통과시킨다.
 *
 * IDNA 변환은 Node 표준 `node:url` 의 WHATWG 구현을 쓴다(폐기된 `punycode`
 * 모듈이 아니다). 따라서 **서버 전용**이다 — 클라이언트 컴포넌트에서 import 하지
 * 않는다. 현재 사용처는 서버 컴포넌트인 `SiteFooter` 뿐이다.
 */

/** `local@domain` 을 로컬부와 도메인부로 쪼갠다. 형태가 아니면 null. */
function splitAddress(email: string): { local: string; domain: string } | null {
  const trimmed = email.trim()
  const at = trimmed.lastIndexOf('@')

  if (at <= 0 || at === trimmed.length - 1) {
    return null
  }

  return { local: trimmed.slice(0, at), domain: trimmed.slice(at + 1) }
}

/**
 * 변환 결과가 비면(= IDNA 가 도메인으로 해석하지 못하면) 원본을 돌려준다.
 * 관리자 오타 한 번에 푸터의 연락처가 통째로 사라지는 편이 더 나쁘다.
 */
function convert(email: string, convertDomain: (domain: string) => string): string {
  const parts = splitAddress(email)

  if (parts === null) {
    return email.trim()
  }

  const converted = convertDomain(parts.domain)

  return converted === '' ? email.trim() : `${parts.local}@${converted}`
}

/** 화면 표기용. `contact@xn--bj0b33kj0qqva.co.kr` → `contact@글자월드.co.kr` */
export function toDisplayEmail(email: string): string {
  return convert(email, domainToUnicode)
}

/** `mailto:` 링크용. `contact@글자월드.co.kr` → `contact@xn--bj0b33kj0qqva.co.kr` */
export function toAsciiEmail(email: string): string {
  return convert(email, domainToASCII)
}

/** 표기형/링크형을 한 번에. 푸터가 이 한 쌍만 쓴다. */
export function toEmailLink(email: string): { display: string; href: string } {
  return { display: toDisplayEmail(email), href: `mailto:${toAsciiEmail(email)}` }
}
