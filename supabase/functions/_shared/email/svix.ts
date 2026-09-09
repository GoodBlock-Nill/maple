/**
 * Svix 표준 웹훅 서명 검증(Resend 가 쓰는 방식).
 *
 * 서명 대상은 `${svix-id}.${svix-timestamp}.${원문 body}` 이고 알고리즘은 HMAC-SHA256,
 * 비밀은 `whsec_` 접두사 뒤의 base64 다. `svix-signature` 헤더에는 `v1,<base64>` 가
 * 공백으로 여러 개 올 수 있다(키 회전 중) — 하나라도 맞으면 통과.
 * (https://docs.svix.com/receiving/verifying-payloads/how-manual —
 *  Resend 의 verify-webhooks-requests 문서가 이 페이지로 안내한다.)
 *
 * 타임스탬프 허용 창은 5분(우리 결정 — Svix 문서는 "허용 범위를 두라"고만 한다).
 * 재전송 공격은 서명이 맞더라도 오래된 전달을 되풀이하는 것이므로 시각도 함께 본다.
 *
 * WebCrypto(`crypto.subtle`)만 쓴다 — Deno(Edge Function)와 Node(vitest) 양쪽에서 돈다.
 */

export const SVIX_TOLERANCE_SECONDS = 5 * 60

const SECRET_PREFIX = 'whsec_'
const SIGNATURE_VERSION = 'v1'

export type SvixHeaders = {
  id: string | null
  timestamp: string | null
  signature: string | null
}

export type SvixVerification = { ok: true } | { ok: false; reason: string }

/** 요청 헤더에서 세 값을 뽑는다. Pro 플랜의 `webhook-*` 접두사도 함께 받는다. */
export function readSvixHeaders(headers: Headers): SvixHeaders {
  return {
    id: headers.get('svix-id') ?? headers.get('webhook-id'),
    timestamp: headers.get('svix-timestamp') ?? headers.get('webhook-timestamp'),
    signature: headers.get('svix-signature') ?? headers.get('webhook-signature'),
  }
}

function decodeBase64(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

function secretBytes(secret: string) {
  const raw = secret.startsWith(SECRET_PREFIX) ? secret.slice(SECRET_PREFIX.length) : secret

  return decodeBase64(raw)
}

/** 길이가 같을 때만 비교하되, 어느 자리에서 갈리든 같은 시간이 걸리게 한다. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let diff = 0

  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }

  return diff === 0
}

/** `id.timestamp.body` 의 HMAC-SHA256 을 base64 로 돌려준다. 테스트가 서명을 만들 때도 쓴다. */
export async function signSvixPayload(
  secret: string,
  id: string,
  timestamp: string,
  body: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const data = new TextEncoder().encode(`${id}.${timestamp}.${body}`)
  const signature = await crypto.subtle.sign('HMAC', key, data)

  return encodeBase64(new Uint8Array(signature))
}

export type VerifySvixOptions = {
  secret: string
  headers: SvixHeaders
  /** 원문 그대로의 요청 본문. JSON 을 다시 직렬화하면 서명이 깨진다. */
  body: string
  /** 현재 시각(초). 테스트 주입용. */
  nowSeconds?: number
  toleranceSeconds?: number
}

export async function verifySvixSignature(options: VerifySvixOptions): Promise<SvixVerification> {
  const { id, timestamp, signature } = options.headers

  if (id === null || timestamp === null || signature === null) {
    return { ok: false, reason: 'missing_headers' }
  }

  if (!/^\d+$/.test(timestamp)) {
    return { ok: false, reason: 'bad_timestamp' }
  }

  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000)
  const tolerance = options.toleranceSeconds ?? SVIX_TOLERANCE_SECONDS

  if (Math.abs(now - Number(timestamp)) > tolerance) {
    return { ok: false, reason: 'timestamp_out_of_tolerance' }
  }

  let expected: string

  try {
    expected = await signSvixPayload(options.secret, id, timestamp, options.body)
  } catch {
    return { ok: false, reason: 'bad_secret' }
  }

  const candidates = signature
    .split(' ')
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith(`${SIGNATURE_VERSION},`))
    .map((entry) => entry.slice(SIGNATURE_VERSION.length + 1))

  if (candidates.length === 0) {
    return { ok: false, reason: 'no_v1_signature' }
  }

  return candidates.some((candidate) => timingSafeEqual(candidate, expected))
    ? { ok: true }
    : { ok: false, reason: 'signature_mismatch' }
}
