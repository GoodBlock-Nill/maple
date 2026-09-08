import { describe, expect, it } from 'vitest'

import {
  FAQ_ANSWER_MAX_LENGTH,
  FAQ_CATEGORIES,
  FAQ_CATEGORY_VALUES,
  FAQ_QUESTION_MAX_LENGTH,
  faqReorderSchema,
  faqSchema,
  hasFaqOrderChanged,
  isFaqCategory,
  moveFaqOrder,
  normalizeFaqOrder,
} from '@/lib/validation/faqs'

import type { FaqOrderItem } from '@/lib/validation/faqs'

const ID = (suffix: string) => `11111111-2222-4333-8444-55555555555${suffix}`

function order(...entries: readonly [string, number][]): readonly FaqOrderItem[] {
  return entries.map(([id, sortOrder]) => ({ id, sortOrder }))
}

describe('FAQ 카테고리', () => {
  it('사용자 사이트와 같은 다섯 종을 같은 순서로 쓴다', () => {
    expect(FAQ_CATEGORY_VALUES).toEqual(['notice', 'account', 'payment', 'bug', 'etc'])
    expect(FAQ_CATEGORIES.map((category) => category.label)).toEqual([
      '공지사항',
      '계정',
      '결제',
      '버그',
      '기타',
    ])
  })

  it('모르는 값은 카테고리가 아니다', () => {
    expect(isFaqCategory('notice')).toBe(true)
    expect(isFaqCategory('event')).toBe(false)
    expect(isFaqCategory(null)).toBe(false)
  })
})

describe('faqSchema', () => {
  const base = { category: 'account', question: '비밀번호를 잊었어요', answer: '재설정하세요.' }

  it('앞뒤 공백을 다듬는다', () => {
    const parsed = faqSchema.parse({ ...base, question: '  질문  ', answer: ' 답변 ', isPublished: true })

    expect(parsed.question).toBe('질문')
    expect(parsed.answer).toBe('답변')
  })

  it(`질문은 ${FAQ_QUESTION_MAX_LENGTH}자까지다`, () => {
    const limit = '가'.repeat(FAQ_QUESTION_MAX_LENGTH)

    expect(faqSchema.safeParse({ ...base, question: limit, isPublished: true }).success).toBe(true)
    expect(faqSchema.safeParse({ ...base, question: `${limit}가`, isPublished: true }).success).toBe(
      false,
    )
  })

  it(`답변은 ${FAQ_ANSWER_MAX_LENGTH}자까지다`, () => {
    const limit = '가'.repeat(FAQ_ANSWER_MAX_LENGTH)

    expect(faqSchema.safeParse({ ...base, answer: limit, isPublished: false }).success).toBe(true)
    expect(faqSchema.safeParse({ ...base, answer: `${limit}가`, isPublished: false }).success).toBe(
      false,
    )
  })

  it('답변의 CRLF 를 LF 로 되돌린다', () => {
    const parsed = faqSchema.parse({ ...base, answer: '한 줄\r\n두 줄', isPublished: true })

    expect(parsed.answer).toBe('한 줄\n두 줄')
  })

  it('빈 질문·답변을 거부한다', () => {
    expect(faqSchema.safeParse({ ...base, question: '  ', isPublished: true }).success).toBe(false)
    expect(faqSchema.safeParse({ ...base, answer: '', isPublished: true }).success).toBe(false)
  })

  it('카테고리 enum 밖의 값을 거부한다', () => {
    expect(faqSchema.safeParse({ ...base, category: 'event', isPublished: true }).success).toBe(
      false,
    )
  })
})

describe('moveFaqOrder', () => {
  const items = order(['a', 0], ['b', 1], ['c', 2])

  it('위로 한 칸 옮기고 순번을 0부터 다시 매긴다', () => {
    expect(moveFaqOrder(items, 'c', 'up')).toEqual([
      { id: 'a', sortOrder: 0 },
      { id: 'c', sortOrder: 1 },
      { id: 'b', sortOrder: 2 },
    ])
  })

  it('아래로 한 칸 옮긴다', () => {
    expect(moveFaqOrder(items, 'a', 'down')).toEqual([
      { id: 'b', sortOrder: 0 },
      { id: 'a', sortOrder: 1 },
      { id: 'c', sortOrder: 2 },
    ])
  })

  it('끝에서 더 밀면 원본을 그대로 돌려준다', () => {
    expect(moveFaqOrder(items, 'a', 'up')).toBe(items)
    expect(moveFaqOrder(items, 'c', 'down')).toBe(items)
  })

  it('없는 id 는 무시한다', () => {
    expect(moveFaqOrder(items, 'zzz', 'up')).toBe(items)
  })

  it('중복·구멍이 있는 기존 순번도 0..n-1 로 정리한다', () => {
    const messy = order(['a', 5], ['b', 5], ['c', 9])

    expect(moveFaqOrder(messy, 'b', 'up')).toEqual([
      { id: 'b', sortOrder: 0 },
      { id: 'a', sortOrder: 1 },
      { id: 'c', sortOrder: 2 },
    ])
  })

  it('원본 배열을 변경하지 않는다', () => {
    const source = order(['a', 0], ['b', 1])
    moveFaqOrder(source, 'b', 'up')

    expect(source).toEqual([
      { id: 'a', sortOrder: 0 },
      { id: 'b', sortOrder: 1 },
    ])
  })
})

describe('normalizeFaqOrder · hasFaqOrderChanged', () => {
  it('보이는 순서를 그대로 0부터 매긴다', () => {
    expect(normalizeFaqOrder(['x', 'y'])).toEqual([
      { id: 'x', sortOrder: 0 },
      { id: 'y', sortOrder: 1 },
    ])
  })

  it('순서가 같으면 저장할 변경이 없다', () => {
    const current = order(['a', 0], ['b', 1])

    expect(hasFaqOrderChanged(current, order(['a', 0], ['b', 1]))).toBe(false)
    expect(hasFaqOrderChanged(current, order(['b', 0], ['a', 1]))).toBe(true)
    expect(hasFaqOrderChanged(current, order(['a', 0]))).toBe(true)
  })
})

describe('faqReorderSchema', () => {
  it('uuid 목록만 받는다', () => {
    expect(
      faqReorderSchema.safeParse({ category: 'etc', ids: [ID('1'), ID('2')] }).success,
    ).toBe(true)
    expect(faqReorderSchema.safeParse({ category: 'etc', ids: ['1'] }).success).toBe(false)
    expect(faqReorderSchema.safeParse({ category: 'etc', ids: [] }).success).toBe(false)
  })
})
