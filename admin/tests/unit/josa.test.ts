import { describe, expect, it } from 'vitest'

import { josa } from '@/lib/utils/josa'

/**
 * 조사 선택은 화면 문구가 통째로 이 함수에 걸려 있다. 받침이 있는 말·없는 말·
 * 'ㄹ' 받침·한글이 아닌 끝 글자 네 갈래를 모두 고정해 둔다.
 */

describe('josa', () => {
  it('should pick the with-final-consonant form after a closed syllable', () => {
    expect(josa('게시글', '을')).toBe('을')
    expect(josa('게시글', '이')).toBe('이')
    expect(josa('게시글', '은')).toBe('은')
    expect(josa('게시글', '과')).toBe('과')
  })

  it('should pick the open-syllable form after a vowel ending', () => {
    expect(josa('댓글', '을')).toBe('을')
    expect(josa('배너', '을')).toBe('를')
    expect(josa('배너', '이')).toBe('가')
    expect(josa('배너', '은')).toBe('는')
    expect(josa('배너', '과')).toBe('와')
  })

  it("should treat a final 'ㄹ' as open for the '로' particle", () => {
    // 서울로 · 처리 중으로 — 'ㄹ' 만 예외다.
    expect(josa('서울', '로')).toBe('로')
    expect(josa('처리 중', '로')).toBe('으로')
    expect(josa('답변 완료', '로')).toBe('로')
  })

  it('should fall back to the first form for digits and latin endings', () => {
    expect(josa('아이템2', '을')).toBe('을')
    expect(josa('MSW', '이')).toBe('이')
    expect(josa('event', '로')).toBe('으로')
  })

  it('should ignore trailing whitespace when reading the last character', () => {
    expect(josa('배너 ', '을')).toBe('를')
  })

  it('should fall back to the first form for an empty word', () => {
    expect(josa('', '을')).toBe('을')
    expect(josa('   ', '이')).toBe('이')
  })
})
