/**
 * 두 개정본의 줄 단위 비교.
 *
 * HTML 을 그대로 비교하면 태그 한 글자가 바뀔 때마다 문서 전체가 달라 보인다.
 * 운영자가 알고 싶은 것은 "어떤 문장이 바뀌었나"이므로, 블록 요소 하나를 한 줄로
 * 눌러 텍스트만 비교한다.
 *
 * 조회 계층(`lib/data/legal.ts`)이 아니라 화면 옆에 두는 이유는 `audit-diff.ts` 와
 * 같다 — 그쪽은 `server-only` 라 단위 테스트에서 import 조차 되지 않는다.
 */

/** 한 줄로 끊는 블록 요소들. 표는 행(tr) 단위로 본다. */
const BLOCK_END = /<\/(?:p|h2|h3|h4|li|tr)>/giu
const TAG = /<[^>]*>/gu

const ENTITIES: readonly (readonly [RegExp, string])[] = [
  [/&lt;/gu, '<'],
  [/&gt;/gu, '>'],
  [/&quot;/gu, '"'],
  [/&#39;/gu, "'"],
  [/&nbsp;/gu, ' '],
  /* `&amp;` 를 마지막에 되돌린다. 먼저 풀면 `&amp;lt;` 가 `<` 로 잘못 살아난다. */
  [/&amp;/gu, '&'],
]

function decode(value: string): string {
  return ENTITIES.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value)
}

/** 표의 셀은 ` | ` 로 이어 붙여 한 줄로 읽히게 한다. */
const CELL_END = /<\/(?:th|td)>/giu

/**
 * 셀 안의 문단 껍데기를 벗긴다.
 *
 * 에디터는 셀 내용을 항상 문단으로 감싸고(`<td><p>1차</p></td>`) 시드본은 글자만
 * 담는다(`<td>1차</td>`). 화면은 같지만 그대로 비교하면 표가 통째로 "바뀐 것"으로
 * 잡혀, 실제 개정 내용이 그 안에 묻힌다.
 */
const CELL_PARAGRAPH = /<(td|th)>\s*<p>|<\/p>\s*<\/(td|th)>/giu

function unwrapCellParagraphs(html: string): string {
  return html.replace(CELL_PARAGRAPH, (match, open?: string, close?: string) =>
    open === undefined ? `</${close ?? 'td'}>` : `<${open}>`,
  )
}

/** 저장된 HTML → 비교용 텍스트 줄. 빈 줄은 버린다. */
export function htmlToDiffLines(html: string): readonly string[] {
  return unwrapCellParagraphs(html)
    .replace(CELL_END, ' | ')
    .replace(BLOCK_END, '\n')
    .replace(TAG, '')
    .split('\n')
    .map((line) => decode(line).replace(/\s+/gu, ' ').replace(/\s*\|\s*$/u, '').trim())
    .filter((line) => line !== '')
}

export type DiffKind = 'same' | 'added' | 'removed'

export type DiffLine = {
  kind: DiffKind
  text: string
}

/**
 * 최장 공통 부분수열(LCS) 기반 줄 비교.
 *
 * 약관은 길어야 수백 줄이라 O(n·m) 표로 충분하다. 휴리스틱(앞뒤 자르기 등)을
 * 얹지 않는 이유: 문단 순서가 통째로 바뀌는 개정이 실제로 있고, 그때 잘못된
 * 정렬을 보여 주면 운영자가 변경을 놓친다.
 */
export function diffLines(before: readonly string[], after: readonly string[]): readonly DiffLine[] {
  const rows = before.length
  const columns = after.length
  const table: number[][] = Array.from({ length: rows + 1 }, () => new Array<number>(columns + 1).fill(0))

  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = columns - 1; j >= 0; j -= 1) {
      const row = table[i] as number[]
      const next = table[i + 1] as number[]

      row[j] =
        before[i] === after[j]
          ? (next[j + 1] as number) + 1
          : Math.max(next[j] as number, row[j + 1] as number)
    }
  }

  const result: DiffLine[] = []
  let i = 0
  let j = 0

  while (i < rows && j < columns) {
    if (before[i] === after[j]) {
      result.push({ kind: 'same', text: before[i] as string })
      i += 1
      j += 1
      continue
    }

    const down = (table[i + 1] as number[])[j] as number
    const right = (table[i] as number[])[j + 1] as number

    if (down >= right) {
      result.push({ kind: 'removed', text: before[i] as string })
      i += 1
    } else {
      result.push({ kind: 'added', text: after[j] as string })
      j += 1
    }
  }

  while (i < rows) {
    result.push({ kind: 'removed', text: before[i] as string })
    i += 1
  }

  while (j < columns) {
    result.push({ kind: 'added', text: after[j] as string })
    j += 1
  }

  return result
}

export type DiffSummary = {
  added: number
  removed: number
}

export function summarizeDiff(lines: readonly DiffLine[]): DiffSummary {
  return {
    added: lines.filter((line) => line.kind === 'added').length,
    removed: lines.filter((line) => line.kind === 'removed').length,
  }
}
