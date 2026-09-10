import { describe, expect, it } from 'vitest'

import {
  findInquiryCategory,
  isDiscardableContent,
  withLegacyCategory,
} from '@/lib/utils/inquiry-prefill'

import type { InquiryCategoryOption } from '@/types/domain'

const CONNECTION_PREFILL = '글자월드 캐릭터 닉네임:\n\n발생 일시:\n상세 내용:'

const CATEGORIES: readonly InquiryCategoryOption[] = [
  {
    key: 'connection',
    label: '접속·서버',
    description: '접속이 안 될 때',
    prefill: CONNECTION_PREFILL,
    subtypes: ['로그인/접속 불가', '강제 종료'],
  },
  { key: 'etc', label: '기타·건의', description: null, prefill: '건의 주제:', subtypes: [] },
  { key: 'empty', label: '양식없음', description: null, prefill: '', subtypes: [] },
]

describe('isDiscardableContent', () => {
  it('should allow replacing empty content', () => {
    // Arrange & Act & Assert
    expect(isDiscardableContent('', CATEGORIES)).toBe(true)
    expect(isDiscardableContent('   \n  ', CATEGORIES)).toBe(true)
  })

  it('should allow replacing an untouched template', () => {
    // Arrange & Act & Assert — 양식 그대로면 지울 것이 없다.
    expect(isDiscardableContent(CONNECTION_PREFILL, CATEGORIES)).toBe(true)
  })

  it('should treat CRLF and trailing whitespace as the same template', () => {
    // Arrange — 브라우저는 textarea 값을 CRLF 로 정규화해서 보낸다.
    const asSubmitted = `${CONNECTION_PREFILL.replace(/\n/g, '\r\n')}\n`

    // Act & Assert
    expect(isDiscardableContent(asSubmitted, CATEGORIES)).toBe(true)
  })

  it('should refuse to discard text the user typed', () => {
    // Arrange & Act & Assert
    expect(isDiscardableContent(`${CONNECTION_PREFILL}\n로그인이 안 됩니다`, CATEGORIES)).toBe(
      false,
    )
    expect(isDiscardableContent('어제부터 접속이 안 됩니다.', CATEGORIES)).toBe(false)
  })

  it('should not treat an empty template as a match', () => {
    // Arrange & Act & Assert — 양식이 빈 카테고리가 모든 내용을 "지워도 되는 것"으로 만들면 안 된다.
    expect(isDiscardableContent('사용자가 쓴 내용', [CATEGORIES[2] as InquiryCategoryOption])).toBe(
      false,
    )
  })
})

describe('findInquiryCategory', () => {
  it('should find by label and return undefined for unknown values', () => {
    // Arrange & Act & Assert
    expect(findInquiryCategory(CATEGORIES, '접속·서버')?.key).toBe('connection')
    expect(findInquiryCategory(CATEGORIES, '없는분류')).toBeUndefined()
  })
})

describe('withLegacyCategory', () => {
  it('should append a category that is no longer on the list', () => {
    // Arrange & Act — 비활성화된 옛 분류로 접수된 문의도 수정할 수 있어야 한다.
    const result = withLegacyCategory(CATEGORIES, '결제')

    // Assert
    expect(result).toHaveLength(CATEGORIES.length + 1)
    /* 세부 유형은 비운다 — 없어진 카테고리의 유형 목록은 어디에도 남아 있지 않다.
       저장된 유형 하나는 폼과 서버가 따로 허용한다. */
    expect(result.at(-1)).toEqual({
      key: 'legacy:결제',
      label: '결제',
      description: null,
      prefill: '',
      subtypes: [],
    })
  })

  it('should leave the list untouched for an active or empty label', () => {
    // Arrange & Act & Assert
    expect(withLegacyCategory(CATEGORIES, '접속·서버')).toBe(CATEGORIES)
    expect(withLegacyCategory(CATEGORIES, '')).toBe(CATEGORIES)
  })
})
