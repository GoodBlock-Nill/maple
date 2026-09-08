import { describe, expect, it } from 'vitest'

import { CREATOR_INTRO, CREATOR_INTRO_TEXT } from '@/lib/mock/site'
import { splitParagraphs } from '@/lib/utils/paragraphs'

describe('splitParagraphs', () => {
  it('should split on blank lines when given a multi-paragraph text', () => {
    expect(splitParagraphs('첫 문단\n\n둘째 문단')).toEqual(['첫 문단', '둘째 문단'])
  })

  it('should keep line breaks inside a paragraph when the break is a single newline', () => {
    // 시안의 소개문은 문단 안 줄바꿈 위치까지 디자인이다.
    expect(splitParagraphs('한 줄\n다음 줄\n\n다른 문단')).toEqual(['한 줄\n다음 줄', '다른 문단'])
  })

  it('should normalize CRLF when the text comes from a browser textarea', () => {
    expect(splitParagraphs('첫 줄\r\n둘째 줄\r\n\r\n다음 문단')).toEqual([
      '첫 줄\n둘째 줄',
      '다음 문단',
    ])
  })

  it('should ignore extra blank lines and whitespace-only lines', () => {
    expect(splitParagraphs('A\n\n\n   \n\nB')).toEqual(['A', 'B'])
  })

  it('should trim surrounding whitespace of each paragraph', () => {
    expect(splitParagraphs('  A  \n\n  B  ')).toEqual(['A', 'B'])
  })

  it('should return empty array when input is empty, whitespace, or null', () => {
    expect(splitParagraphs('')).toEqual([])
    expect(splitParagraphs('   \n  \n ')).toEqual([])
    expect(splitParagraphs(null)).toEqual([])
    expect(splitParagraphs(undefined)).toEqual([])
  })

  it('should reproduce the four design paragraphs from the fallback text', () => {
    // 폴백이 DB 값과 같은 경로로 쪼개지는지 — 화면이 갈라지지 않는 근거다.
    expect(CREATOR_INTRO).toHaveLength(4)
    expect(CREATOR_INTRO).toEqual(splitParagraphs(CREATOR_INTRO_TEXT))
    expect(CREATOR_INTRO[0]).toBe(
      "크리에이터 '팡이요'와 어깨를 나란히 하며 오랜 시간\n메이플스토리 콘텐츠를 이끌어온 유서 깊은 크리에이터입니다.",
    )
  })
})
