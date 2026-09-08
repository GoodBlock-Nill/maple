/**
 * 여러 문단이 담긴 한 덩어리 텍스트 → 문단 배열.
 *
 * `site_settings.creator_intro` 같은 관리자 입력은 textarea 한 칸에 들어오고
 * 문단 구분은 **빈 줄**이다(마이그레이션 20260908000500 의 컬럼 주석). 화면은
 * 문단마다 `<p>` 를 그리므로 그 경계를 여기 한 곳에서만 해석한다.
 *
 * 문단 **안**의 줄바꿈은 그대로 남긴다 — 시안의 소개문은 줄바꿈 위치까지
 * 디자인의 일부라 `white-space: pre-line` 으로 렌더된다.
 */

/** 브라우저 textarea 는 CRLF 로 보내고 Node/DB 는 LF 로 다룬다. 한쪽으로 모은다. */
const CRLF = /\r\n?/gu

/** 빈 줄(공백만 있는 줄 포함) 하나 이상이 문단 경계다. */
const PARAGRAPH_BREAK = /\n[ \t]*\n[\s]*/u

export function splitParagraphs(text: string | null | undefined): readonly string[] {
  if (typeof text !== 'string') {
    return []
  }

  return (
    text
      .replace(CRLF, '\n')
      .split(PARAGRAPH_BREAK)
      /* 문단 앞뒤 공백만 턴다. 안쪽 줄바꿈은 디자인이므로 건드리지 않는다. */
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0)
  )
}
