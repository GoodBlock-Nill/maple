/**
 * 본문 정제 · 첨부 선별.
 *
 * 콘솔은 문의 본문을 **평문**으로 그린다(`whitespace-pre-line`). 그래서 HTML 은 저장 전에
 * 텍스트로 바꾼다 — 태그를 살려 두면 정제 규칙을 콘솔까지 끌고 가야 하고, 메일 HTML 은
 * 추적 픽셀·원격 이미지·스타일 폭탄의 온상이다. `text/plain` 이 있으면 그것을 우선한다.
 *
 * 의존성 없이 돌아야 한다(Deno · Node 공용). 정규식 기반의 소박한 변환이지만 목적은
 * "읽을 수 있는 평문"이고, 렌더링 충실도가 아니다.
 */

import type { InboundAttachmentRef } from './normalize.ts'

export const CONTENT_MAX_LENGTH = 20_000

export const TRUNCATED_NOTE = '\n\n[본문이 20,000자를 넘어 잘렸습니다]'

export const RATE_LIMITED_PREFIX = '[자동 종료: 과다 수신]'

export const EMPTY_CONTENT = '(본문 없음)'

/** 개당 10MB · 최대 3개(inquiries_attachments_max_3 제약과 같다). */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const MAX_ATTACHMENTS = 3

/**
 * 허용 MIME. 기획서는 "이미지 · PDF · zip · txt" 라 했고, 버킷 `inquiry-attachments` 의
 * allowed_mime_types 와 **정확히 같은 목록**이어야 한다(20260909000300 마이그레이션) —
 * 여기서 통과시킨 파일이 버킷에서 400 으로 막히면 첨부만 조용히 사라진다.
 */
export const ALLOWED_ATTACHMENT_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/zip',
  'text/plain',
]

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16)

      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }

    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10)

      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }

    return ENTITIES[entity.toLowerCase()] ?? whole
  })
}

/** HTML → 읽을 수 있는 평문. 스크립트·스타일·머리말은 내용까지 버린다. */
export function htmlToText(html: string): string {
  const withoutBlocks = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|head|title|template|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '')

  const withBreaks = withoutBlocks
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(
      /<\/(p|div|tr|h[1-6]|blockquote|pre|table|ul|ol|section|article|header|footer)>/gi,
      '\n\n',
    )
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/(td|th)>/gi, '\t')
    .replace(
      /<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
      (_whole, href: string, label: string) => {
        const text = label.replace(/<[^>]+>/g, '').trim()

        return text === '' || text === href ? href : `${text} (${href})`
      },
    )

  const stripped = withBreaks.replace(/<[^>]+>/g, '')

  return decodeEntities(stripped)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/** 상한을 넘으면 잘라내고 표기를 남긴다. 표기까지 합쳐도 상한 안이다. */
export function capContent(text: string): string {
  if (text.length <= CONTENT_MAX_LENGTH) {
    return text
  }

  return `${text.slice(0, CONTENT_MAX_LENGTH - TRUNCATED_NOTE.length)}${TRUNCATED_NOTE}`
}

/** 저장할 본문. text 우선, 없으면 html 을 평문화, 둘 다 없으면 자리표시자. */
export function buildInquiryContent(text: string | null, html: string | null): string {
  const plain = (text ?? '').trim()
  const body = plain !== '' ? plain.replace(/\r\n?/g, '\n') : html !== null ? htmlToText(html) : ''

  return capContent(body === '' ? EMPTY_CONTENT : body)
}

export function markRateLimited(content: string): string {
  return capContent(`${RATE_LIMITED_PREFIX}\n\n${content}`)
}

export type AttachmentSelection = {
  accepted: InboundAttachmentRef[]
  /** 허용 목록 밖 · 크기 초과. 본문 끝에 이름을 남긴다. */
  excluded: { filename: string; reason: 'type' | 'size' }[]
  /** 허용됐지만 3개를 넘어 버린 개수. */
  overflow: number
}

export function selectAttachments(
  attachments: readonly InboundAttachmentRef[],
): AttachmentSelection {
  const accepted: InboundAttachmentRef[] = []
  const excluded: AttachmentSelection['excluded'] = []
  let overflow = 0

  for (const attachment of attachments) {
    if (!ALLOWED_ATTACHMENT_TYPES.includes(attachment.contentType)) {
      excluded.push({ filename: attachment.filename, reason: 'type' })

      continue
    }

    if (attachment.size !== null && attachment.size > MAX_ATTACHMENT_BYTES) {
      excluded.push({ filename: attachment.filename, reason: 'size' })

      continue
    }

    if (accepted.length >= MAX_ATTACHMENTS) {
      overflow += 1

      continue
    }

    accepted.push(attachment)
  }

  return { accepted, excluded, overflow }
}

/** 제외·초과된 첨부의 사실을 본문 끝에 남긴다. 운영자가 "첨부가 없다"고 오해하지 않게. */
export function appendAttachmentNotes(content: string, selection: AttachmentSelection): string {
  const notes: string[] = []

  if (selection.excluded.length > 0) {
    notes.push(`제외된 첨부: ${selection.excluded.map((entry) => entry.filename).join(', ')}`)
  }

  if (selection.overflow > 0) {
    const total = selection.accepted.length + selection.overflow

    notes.push(`첨부 ${total}개 중 ${selection.accepted.length}개만 저장했습니다.`)
  }

  return notes.length === 0 ? content : capContent(`${content}\n\n${notes.join('\n')}`)
}

const FILENAME_MAX_LENGTH = 80

/**
 * Storage 객체 키에 안전한 파일 이름. 경로 구분자·제어 문자·비ASCII 를 걷어내고
 * 앞에 순번을 붙여 같은 메일의 동명 파일이 서로 덮어쓰지 않게 한다.
 * 원래 이름은 jsonb 의 `name` 에 따로 남으므로 여기서 잃어도 화면에는 보인다.
 */
export function safeStorageFilename(filename: string, index: number): string {
  const base = filename.split(/[\\/]/).pop() ?? ''
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  const ext =
    dot > 0
      ? base
          .slice(dot)
          .replace(/[^A-Za-z0-9.]/g, '')
          .slice(0, 10)
      : ''
  const cleanStem = stem
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, FILENAME_MAX_LENGTH)

  return `${index + 1}-${cleanStem === '' ? 'file' : cleanStem}${ext.toLowerCase()}`
}
