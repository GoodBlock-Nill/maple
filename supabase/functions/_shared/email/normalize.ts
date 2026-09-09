/**
 * 제공자 페이로드 → `InboundEmail` 정규화.
 *
 * Resend 의 `email.received` 웹훅은 **메타데이터만** 싣는다(본문·헤더·첨부 내용 없음 —
 * https://resend.com/docs/dashboard/receiving/create-receiving-webhook). 본문은
 * `GET /emails/receiving/{email_id}` 로 따로 받는다. 그래서 이 모듈은 "웹훅 data" 와
 * "API 로 받은 전체 메일" 두 조각을 합친다. 인라인으로 `text`/`html` 이 실려 오는 제공자
 * (또는 Resend 의 향후 변경)도 그대로 받아들이도록 두 꼴을 모두 허용한다.
 *
 * SPF/DKIM/DMARC 판정은 Resend 문서에 필드가 없다. `Authentication-Results` 헤더가
 * 있으면 거기서 읽고, 제공자가 `spf`/`dkim`/`dmarc` 필드를 주면 그것을 우선한다.
 */

import { extractAddress, splitMessageIds, stripAngleBrackets } from './thread.ts'

export type EmailAddress = { address: string; name: string | null }

export type EmailAuth = { spf: string | null; dkim: string | null; dmarc: string | null }

export type InboundAttachmentRef = {
  id: string | null
  filename: string
  contentType: string
  size: number | null
  downloadUrl: string | null
  contentDisposition: string | null
}

export type InboundEmail = {
  /** 제공자 쪽 메일 id(Resend `email_id`). 본문·첨부를 다시 조회할 때 쓴다. */
  providerEmailId: string | null
  /** RFC Message-ID(꺾쇠 제거). 중복 접수 방지 키. */
  messageId: string | null
  inReplyTo: string | null
  references: string[]
  from: EmailAddress
  /** To · Cc · 실제 배달 대상(received_for)을 합친 목록. reply+key 판정에 쓴다. */
  to: string[]
  subject: string
  text: string | null
  html: string | null
  /** 헤더 이름은 소문자로 통일. */
  headers: Record<string, string>
  attachments: InboundAttachmentRef[]
  auth: EmailAuth
  receivedAt: string | null
}

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {}
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function asStringList(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.trim() === '' ? [] : [value]
  }

  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []
}

/** `"이름" <a@b>` · `이름 <a@b>` · `a@b`. 주소를 못 찾으면 원문을 그대로 주소 자리에 둔다. */
export function parseEmailAddress(raw: string | null | undefined): EmailAddress {
  const source = (raw ?? '').trim()
  const address = extractAddress(source) ?? source.toLowerCase()
  const angle = source.indexOf('<')
  const name = angle > 0 ? source.slice(0, angle).trim().replace(/^"|"$/g, '').trim() : ''

  return { address, name: name === '' ? null : name }
}

/**
 * 헤더는 제공자마다 모양이 다르다 — 객체(`{ From: … }`) 또는 `[{ name, value }]`.
 * 둘 다 소문자 키의 평면 객체로 만든다. 같은 이름이 여러 번이면 마지막 값을 남기되
 * `received` 만은 첫 값을 유지한다(가장 바깥 홉이 첫 줄이다 — 우리는 쓰지 않지만 관례를 지킨다).
 */
export function normalizeHeaders(raw: unknown): Record<string, string> {
  const result: Record<string, string> = {}

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const record = asRecord(entry)
      const name = asString(record.name)?.toLowerCase()
      const value = typeof record.value === 'string' ? record.value : null

      if (name !== undefined && name !== null && value !== null) {
        if (name === 'received' && result[name] !== undefined) {
          continue
        }

        result[name] = value
      }
    }

    return result
  }

  for (const [name, value] of Object.entries(asRecord(raw))) {
    if (typeof value === 'string') {
      result[name.toLowerCase()] = value
    } else if (Array.isArray(value)) {
      const first = value.find((item): item is string => typeof item === 'string')

      if (first !== undefined) {
        result[name.toLowerCase()] = first
      }
    }
  }

  return result
}

/** `Authentication-Results: mx; spf=pass …; dkim=pass …; dmarc=fail …` 에서 세 결과를 뽑는다. */
export function parseAuthenticationResults(header: string | null | undefined): EmailAuth {
  const pick = (key: 'spf' | 'dkim' | 'dmarc'): string | null => {
    const match = (header ?? '').match(new RegExp(`\\b${key}=([a-z]+)`, 'i'))

    return match?.[1]?.toLowerCase() ?? null
  }

  return { spf: pick('spf'), dkim: pick('dkim'), dmarc: pick('dmarc') }
}

function authFromRecord(record: UnknownRecord, headers: Record<string, string>): EmailAuth {
  const fromHeader = parseAuthenticationResults(headers['authentication-results'])
  const explicit = asRecord(record.authentication ?? record.auth)

  return {
    spf: asString(explicit.spf ?? record.spf)?.toLowerCase() ?? fromHeader.spf,
    dkim: asString(explicit.dkim ?? record.dkim)?.toLowerCase() ?? fromHeader.dkim,
    dmarc: asString(explicit.dmarc ?? record.dmarc)?.toLowerCase() ?? fromHeader.dmarc,
  }
}

function normalizeAttachments(raw: unknown): InboundAttachmentRef[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.map((entry) => {
    const record = asRecord(entry)
    const size =
      typeof record.size === 'number' && Number.isFinite(record.size) ? record.size : null

    return {
      id: asString(record.id),
      filename: asString(record.filename) ?? asString(record.name) ?? 'attachment',
      contentType: (asString(record.content_type) ?? asString(record.contentType) ?? '')
        .split(';')[0]!
        .trim()
        .toLowerCase(),
      size,
      downloadUrl: asString(record.download_url) ?? asString(record.downloadUrl),
      contentDisposition: asString(record.content_disposition),
    }
  })
}

/**
 * 웹훅 `data` 와 API 전체 메일을 합친다. 전체 메일이 있으면 본문·헤더·첨부는 그쪽을 우선한다
 * (웹훅의 첨부에는 size 가 없다). 없으면 웹훅에 실린 값으로 최대한 채운다.
 */
export function normalizeInbound(webhookData: unknown, fullEmail: unknown = null): InboundEmail {
  const hook = asRecord(webhookData)
  const full = asRecord(fullEmail)
  const merged: UnknownRecord = { ...hook, ...full }
  const headers = normalizeHeaders(merged.headers)
  const messageId =
    asString(merged.message_id) ?? asString(merged.messageId) ?? headers['message-id'] ?? null
  const attachmentsSource = Array.isArray(full.attachments) ? full.attachments : hook.attachments
  const to = [
    ...asStringList(merged.to),
    ...asStringList(merged.cc),
    ...asStringList(merged.received_for),
  ]

  return {
    providerEmailId: asString(merged.email_id) ?? asString(full.id) ?? null,
    messageId: messageId === null ? null : stripAngleBrackets(messageId),
    inReplyTo:
      headers['in-reply-to'] !== undefined ? stripAngleBrackets(headers['in-reply-to']) : null,
    references: splitMessageIds(headers['references']),
    from: parseEmailAddress(asString(merged.from) ?? headers['from']),
    to: [...new Set(to)],
    subject: asString(merged.subject) ?? headers['subject'] ?? '',
    text: asString(merged.text),
    html: asString(merged.html),
    headers,
    attachments: normalizeAttachments(attachmentsSource),
    auth: authFromRecord(merged, headers),
    receivedAt: asString(merged.created_at),
  }
}
