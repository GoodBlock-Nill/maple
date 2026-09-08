/** 굵게 표시할지 여부와 함께 담은 텍스트 조각. */
export type PolicyTextSegment = {
  readonly text: string
  readonly bold: boolean
}

const BOLD_PATTERN = /\*\*(.+?)\*\*/g

/**
 * 운영정책 원문의 `**굵게**` 표기만 골라 조각으로 나눈다.
 *
 * 전체 마크다운을 파싱하는 대신 이 최소 표기만 처리해, 원문(`docs/*.md`)의
 * 문구를 그대로 보존하면서도 화면에는 `**` 기호 없이 강조만 남긴다.
 */
export function parsePolicyEmphasis(source: string): readonly PolicyTextSegment[] {
  const segments: PolicyTextSegment[] = []
  let cursor = 0

  for (const match of source.matchAll(BOLD_PATTERN)) {
    const index = match.index ?? cursor
    const full = match[0] ?? ''
    const inner = match[1] ?? ''

    if (index > cursor) {
      segments.push({ text: source.slice(cursor, index), bold: false })
    }
    segments.push({ text: inner, bold: true })
    cursor = index + full.length
  }

  if (cursor < source.length) {
    segments.push({ text: source.slice(cursor), bold: false })
  }

  return segments
}
