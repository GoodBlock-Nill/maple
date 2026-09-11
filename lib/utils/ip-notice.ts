/**
 * IP 고지 문단 파싱.
 *
 * `site_settings.ip_notice`(그리고 그 폴백 `IP_NOTICE`)는 4줄을 `\n` 로 구분해
 * 저장한다. 화면(`FooterIpNotice`)은 그 줄들을 `<br>` 로 붙이고, 그중 특정
 * 고유명사(`MapleStory`, `NEXON Korea Corp.` 등)만 semibold 로 강조해야 한다.
 * 이 판정을 컴포넌트 밖 순수 함수로 뽑아 두면 서버 컴포넌트를 거치지 않고도
 * 단위 테스트로 검증할 수 있다.
 */

/**
 * 굵게 강조할 고유명사 목록(시안 footer-v3-home.png 실측).
 * `'MapleStory Worlds'` 를 `'MapleStory'` 보다 먼저 매치해야 한다 — 뒤에서
 * 길이 기준으로 다시 정렬하지만, 목록 자체도 겹치는 순서를 명확히 남긴다.
 */
const BOLD_TERMS: readonly string[] = [
  "'MapleStory Worlds'",
  "'MapleStory'",
  'NEXON Korea Corp.',
  'Toben Studio Inc.',
] as const

/** 정규식 특수문자를 이스케이프한다(작은따옴표·마침표가 포함된 고유명사라 필요). */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

/** 긴 문자열부터 매치해야 `'MapleStory'` 가 `'MapleStory Worlds'` 안에서 먼저 끊기지 않는다. */
const BOLD_PATTERN = new RegExp(
  [...BOLD_TERMS].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|'),
  'gu',
)

export type IpNoticeSegment = {
  text: string
  isBold: boolean
}

/** 한 덩어리 텍스트를 빈 줄 없이 줄 단위로 쪼갠다(공백만 있는 줄은 버린다). */
export function splitIpNoticeLines(text: string): readonly string[] {
  return text
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

/** 한 줄을 굵게/보통 구간으로 나눈다. 매치가 없으면 구간 하나(보통)만 돌려준다. */
export function segmentIpNoticeLine(line: string): readonly IpNoticeSegment[] {
  const segments: IpNoticeSegment[] = []
  let lastIndex = 0

  for (const match of line.matchAll(BOLD_PATTERN)) {
    const start = match.index ?? 0

    if (start > lastIndex) {
      segments.push({ text: line.slice(lastIndex, start), isBold: false })
    }

    segments.push({ text: match[0], isBold: true })
    lastIndex = start + match[0].length
  }

  if (lastIndex < line.length) {
    segments.push({ text: line.slice(lastIndex), isBold: false })
  }

  return segments
}
