import { describe, expect, it } from 'vitest'

import { diffLines, htmlToDiffLines, summarizeDiff } from '@/components/legal/version-diff'

/**
 * 비교는 운영자가 "무엇이 바뀌었나"를 확인하는 마지막 관문이다. 여기가 조용히
 * 틀리면 잘못된 문안이 그대로 발행된다.
 */

describe('htmlToDiffLines', () => {
  it('should make one line per block element', () => {
    expect(htmlToDiffLines('<h2>1. 총칙</h2><p>첫 문단</p><ul><li>가</li><li>나</li></ul>')).toEqual([
      '1. 총칙',
      '첫 문단',
      '가',
      '나',
    ])
  })

  it('should join table cells of one row with a pipe', () => {
    expect(
      htmlToDiffLines('<table><tbody><tr><td>1차</td><td>7일</td></tr></tbody></table>'),
    ).toEqual(['1차 | 7일'])
  })

  it('should drop inline markup but keep the words', () => {
    expect(htmlToDiffLines('<p><strong>[1-1]</strong>본문 <em>강조</em></p>')).toEqual([
      '[1-1]본문 강조',
    ])
  })

  it('should decode entities so the comparison reads like the document', () => {
    expect(htmlToDiffLines('<p>a &amp; b &lt;c&gt;</p>')).toEqual(['a & b <c>'])
  })

  /* 에디터는 셀 내용을 문단으로 감싸고 시드본은 글자만 담는다. 화면이 같으므로
     비교에서도 같아야 한다. */
  it('should read an editor table the same way as a seeded one', () => {
    const seeded = '<table><tbody><tr><td>1차</td><td>7일</td></tr></tbody></table>'
    const edited = '<table><tbody><tr><td><p>1차</p></td><td><p>7일</p></td></tr></tbody></table>'

    expect(htmlToDiffLines(edited)).toEqual(htmlToDiffLines(seeded))
  })

  it('should drop empty blocks', () => {
    expect(htmlToDiffLines('<p></p><p>  </p><p>본문</p>')).toEqual(['본문'])
  })
})

describe('diffLines', () => {
  it('should mark an inserted line and keep the rest', () => {
    const result = diffLines(['가', '다'], ['가', '나', '다'])

    expect(result).toEqual([
      { kind: 'same', text: '가' },
      { kind: 'added', text: '나' },
      { kind: 'same', text: '다' },
    ])
  })

  it('should mark a removed line', () => {
    expect(diffLines(['가', '나'], ['가'])).toEqual([
      { kind: 'same', text: '가' },
      { kind: 'removed', text: '나' },
    ])
  })

  it('should show a replacement as a removal followed by an addition', () => {
    expect(summarizeDiff(diffLines(['가'], ['나']))).toEqual({ added: 1, removed: 1 })
  })

  it('should report no change for identical documents', () => {
    expect(summarizeDiff(diffLines(['가', '나'], ['가', '나']))).toEqual({ added: 0, removed: 0 })
  })

  it('should handle an empty side', () => {
    expect(diffLines([], ['가'])).toEqual([{ kind: 'added', text: '가' }])
    expect(diffLines(['가'], [])).toEqual([{ kind: 'removed', text: '가' }])
  })

  /* 문단 순서가 통째로 바뀌는 개정이 실제로 있다. 최장 공통 부분수열이라 가장 긴
     공통 흐름을 남기고 나머지만 이동으로 보여 준다. */
  it('should keep the longest common run when paragraphs move', () => {
    const result = diffLines(['가', '나', '다'], ['나', '다', '가'])

    expect(result.filter((line) => line.kind === 'same').map((line) => line.text)).toEqual([
      '나',
      '다',
    ])
  })
})

describe('실제 개정 시나리오', () => {
  it('should point at the single added paragraph', () => {
    const before = '<h2>1. 총칙</h2><p>기존 문단</p>'
    const after = '<h2>1. 총칙</h2><p>기존 문단</p><p>[E2E] 문단</p>'
    const lines = diffLines(htmlToDiffLines(before), htmlToDiffLines(after))

    expect(summarizeDiff(lines)).toEqual({ added: 1, removed: 0 })
    expect(lines.at(-1)).toEqual({ kind: 'added', text: '[E2E] 문단' })
  })
})
