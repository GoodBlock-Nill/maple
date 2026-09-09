/**
 * 스레드 열쇠 — `reply+<key>@<도메인>` 회신 주소.
 *
 * 운영자 답신의 Reply-To 에 이 주소를 넣어 두면, 사용자가 메일 클라이언트에서 "답장"을
 * 눌렀을 때 그 주소로 돌아오고, 우리는 key 하나로 어느 문의인지 알 수 있다.
 * In-Reply-To 헤더 매칭은 보조 수단이다 — 클라이언트마다 헤더를 빼먹거나 고쳐 쓴다.
 */

export const THREAD_KEY_LENGTH = 24

/**
 * 12바이트 → 소문자 hex 24자(96비트).
 *
 * base64url 을 쓰지 않는 이유: 메일 주소의 로컬파트는 규격상 대소문자를 구분하지만
 * 전달 서버·클라이언트가 소문자로 접어 버리는 일이 흔하다. 대소문자에 의미를 두면
 * 그런 경로로 돌아온 회신이 스레드를 잃는다. hex 는 접어도 같은 값이다.
 */
const THREAD_KEY_BYTES = 12

const THREAD_KEY_PATTERN = /^[a-f0-9]{24}$/

const REPLY_LOCAL_PREFIX = 'reply+'

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** 무작위 24자 소문자 hex 토큰. `random` 은 테스트 주입용. */
export function generateThreadKey(
  random: (length: number) => Uint8Array = (length) =>
    crypto.getRandomValues(new Uint8Array(length)),
): string {
  return toHex(random(THREAD_KEY_BYTES)).slice(0, THREAD_KEY_LENGTH)
}

/** 대소문자를 접은 뒤 판정한다(위 주석). */
export function isThreadKey(value: string): boolean {
  return THREAD_KEY_PATTERN.test(value.toLowerCase())
}

export function replyAddress(threadKey: string, replyDomain: string): string {
  return `${REPLY_LOCAL_PREFIX}${threadKey}@${replyDomain}`
}

/** `"이름" <a@b.c>` · `a@b.c` 어느 꼴이든 주소 부분만 소문자로. 주소가 아니면 null. */
export function extractAddress(raw: string): string | null {
  const angle = raw.match(/<([^<>\s]+@[^<>\s]+)>/)
  const candidate = (angle?.[1] ?? raw).trim().replace(/^<|>$/g, '')

  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(candidate) ? candidate.toLowerCase() : null
}

/**
 * 수신 주소 목록에서 `reply+<key>@` 를 찾아 key 를 돌려준다.
 *
 * `replyDomain` 을 주면 그 도메인(대소문자 무시)만 인정한다 — 남의 도메인로 온
 * `reply+…` 를 우리 스레드로 붙이지 않게 한다. 없으면 로컬파트만 본다(도메인 미정 단계).
 */
export function parseReplyRecipient(
  recipients: readonly string[],
  replyDomain: string | null = null,
): string | null {
  for (const recipient of recipients) {
    const address = extractAddress(recipient)

    if (address === null) {
      continue
    }

    const at = address.lastIndexOf('@')
    const local = address.slice(0, at)
    const domain = address.slice(at + 1)

    if (!local.startsWith(REPLY_LOCAL_PREFIX)) {
      continue
    }

    if (replyDomain !== null && domain !== replyDomain.toLowerCase()) {
      continue
    }

    const key = local.slice(REPLY_LOCAL_PREFIX.length).toLowerCase()

    if (isThreadKey(key)) {
      return key
    }
  }

  return null
}

/** `<abc@x>` → `abc@x`. 앞뒤 공백도 걷어낸다. */
export function stripAngleBrackets(value: string): string {
  return value.trim().replace(/^<+|>+$/g, '')
}

/** `References` 처럼 공백·쉼표로 여러 개가 오는 헤더를 개별 Message-ID 로 나눈다. */
export function splitMessageIds(value: string | null | undefined): string[] {
  if (value === null || value === undefined) {
    return []
  }

  return value
    .split(/[\s,]+/)
    .map((entry) => stripAngleBrackets(entry))
    .filter((entry) => entry !== '')
}

/**
 * DB 에서 우리 발신 메일을 찾을 때 시도할 후보 id 들(중복 제거, 순서 유지).
 *
 * 저장된 값이 `<...>` 를 포함할 수도, 안 할 수도 있어 두 꼴을 모두 낸다. 제공자가
 * 돌려준 발송 id 가 Message-ID 의 로컬파트로 쓰이는 경우까지 포괄하도록 `@` 앞부분도
 * 후보에 넣는다(형식이 문서에 명시돼 있지 않아 관용적으로 처리한다).
 */
export function candidateMessageIds(
  inReplyTo: string | null,
  references: readonly string[],
): string[] {
  const seen = new Set<string>()
  const candidates: string[] = []
  const push = (value: string) => {
    if (value !== '' && !seen.has(value)) {
      seen.add(value)
      candidates.push(value)
    }
  }

  // In-Reply-To 가 가장 직접적인 부모다. References 는 오래된 것부터 오므로 뒤에서 앉힌다.
  const ordered = [...splitMessageIds(inReplyTo), ...[...references].reverse()]

  for (const raw of ordered) {
    const bare = stripAngleBrackets(raw)

    push(bare)
    push(`<${bare}>`)

    const at = bare.indexOf('@')

    if (at > 0) {
      push(bare.slice(0, at))
    }
  }

  return candidates
}
