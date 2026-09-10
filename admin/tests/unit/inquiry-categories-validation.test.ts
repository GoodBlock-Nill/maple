import { describe, expect, it } from 'vitest'

import { hasOrderChanged, moveOrder, normalizeOrder } from '@/lib/utils/sort-order'
import {
  INQUIRY_CATEGORY_DESCRIPTION_MAX,
  INQUIRY_CATEGORY_LABEL_MAX,
  INQUIRY_CATEGORY_PREFILL_MAX,
  INQUIRY_SUBTYPE_COUNT_MAX,
  INQUIRY_SUBTYPE_MAX,
  inquiryCategoryReorderSchema,
  inquiryCategorySchema,
  toCategoryKey,
  toNullableText,
} from '@/lib/validation/inquiry-categories'

const VALID = {
  label: '접속·서버',
  description: '로그인·접속 불가',
  prefill: '글자월드 캐릭터 닉네임:\n상세 내용:',
  subtypes: ['로그인/접속 불가', '강제 종료'],
  isActive: true,
}

describe('inquiryCategorySchema', () => {
  it('should accept a filled form', () => {
    // Arrange & Act
    const parsed = inquiryCategorySchema.safeParse(VALID)

    // Assert
    expect(parsed.success).toBe(true)
    expect(parsed.data?.prefill).toBe('글자월드 캐릭터 닉네임:\n상세 내용:')
  })

  it('should require a label', () => {
    // Arrange & Act
    const parsed = inquiryCategorySchema.safeParse({ ...VALID, label: '   ' })

    // Assert
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toContain('이름')
  })

  it('should keep the DB check limits', () => {
    // Arrange & Act — 화면이 통과시킨 값이 저장에서 23514 로 떨어지면 안 된다.
    const longLabel = inquiryCategorySchema.safeParse({
      ...VALID,
      label: '가'.repeat(INQUIRY_CATEGORY_LABEL_MAX + 1),
    })
    const longDescription = inquiryCategorySchema.safeParse({
      ...VALID,
      description: '가'.repeat(INQUIRY_CATEGORY_DESCRIPTION_MAX + 1),
    })
    const longPrefill = inquiryCategorySchema.safeParse({
      ...VALID,
      prefill: '가'.repeat(INQUIRY_CATEGORY_PREFILL_MAX + 1),
    })

    // Assert
    expect(longLabel.success).toBe(false)
    expect(longDescription.success).toBe(false)
    expect(longPrefill.success).toBe(false)
  })

  it('should normalise CRLF in the prefill', () => {
    // Arrange & Act — 브라우저는 textarea 값을 CRLF 로 보낸다. 사용자 폼과 같은 규칙으로 되돌린다.
    const parsed = inquiryCategorySchema.safeParse({ ...VALID, prefill: '첫 줄:\r\n둘째 줄:' })

    // Assert
    expect(parsed.data?.prefill).toBe('첫 줄:\n둘째 줄:')
  })

  it('should allow an empty description and prefill', () => {
    // Arrange & Act
    const parsed = inquiryCategorySchema.safeParse({ ...VALID, description: '', prefill: '' })

    // Assert
    expect(parsed.success).toBe(true)
    expect(toNullableText(parsed.data?.description ?? '')).toBeNull()
  })
})

describe('inquiryCategorySchema 의 세부 문의 유형', () => {
  it('should keep the order the operator arranged', () => {
    // Arrange & Act — 순서가 곧 사용자 폼 셀렉트의 순서다.
    const parsed = inquiryCategorySchema.safeParse({
      ...VALID,
      subtypes: ['강제 종료', '로그인/접속 불가'],
    })

    // Assert
    expect(parsed.data?.subtypes).toEqual(['강제 종료', '로그인/접속 불가'])
  })

  it('should drop blank rows and trim the rest', () => {
    // Arrange & Act — 편집기에서 비운 칸은 "지운 항목"이다.
    const parsed = inquiryCategorySchema.safeParse({
      ...VALID,
      subtypes: ['  강제 종료 ', '   ', ''],
    })

    // Assert
    expect(parsed.data?.subtypes).toEqual(['강제 종료'])
  })

  it('should allow an empty list', () => {
    // Arrange & Act — 세부 유형이 없으면 사용자 폼이 셀렉트를 잠그고 '기타' 로 접수한다.
    const parsed = inquiryCategorySchema.safeParse({ ...VALID, subtypes: [] })

    // Assert
    expect(parsed.success).toBe(true)
    expect(parsed.data?.subtypes).toEqual([])
  })

  it('should keep the DB check limits', () => {
    // Arrange & Act — DB CHECK(`inquiry_categories_subtypes_shape`)와 같은 숫자다.
    const tooMany = inquiryCategorySchema.safeParse({
      ...VALID,
      subtypes: Array.from(
        { length: INQUIRY_SUBTYPE_COUNT_MAX + 1 },
        (_item, index) => `유형${index}`,
      ),
    })
    const tooLong = inquiryCategorySchema.safeParse({
      ...VALID,
      subtypes: ['가'.repeat(INQUIRY_SUBTYPE_MAX + 1)],
    })

    // Assert
    expect(tooMany.success).toBe(false)
    expect(tooLong.success).toBe(false)
  })

  it('should reject duplicates', () => {
    // Arrange & Act — 같은 문구가 두 번 보이는 셀렉트는 고를 수가 없다.
    const parsed = inquiryCategorySchema.safeParse({
      ...VALID,
      subtypes: ['강제 종료', ' 강제 종료 '],
    })

    // Assert
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toContain('두 번')
  })
})

describe('toCategoryKey', () => {
  it('should slugify a latin label', () => {
    // Arrange & Act & Assert
    expect(toCategoryKey('Save Data')).toBe('save-data')
    expect(toCategoryKey('  UI / 기능  ')).toBe('ui')
  })

  it('should fall back to a random key for a Korean-only label', () => {
    // Arrange & Act — 한글은 슬러그로 옮길 라틴 문자가 없다. key 는 화면에 보이지 않는 식별자다.
    const key = toCategoryKey('접속·서버')

    // Assert — DB CHECK(`inquiry_categories_key_shape`)를 만족해야 한다.
    expect(key).toMatch(/^[a-z0-9][a-z0-9-]{0,39}$/)
    expect(key.startsWith('c-')).toBe(true)
  })
})

describe('inquiryCategoryReorderSchema', () => {
  it('should require at least one uuid', () => {
    // Arrange & Act & Assert
    expect(inquiryCategoryReorderSchema.safeParse({ ids: [] }).success).toBe(false)
    expect(inquiryCategoryReorderSchema.safeParse({ ids: ['nope'] }).success).toBe(false)
    expect(
      inquiryCategoryReorderSchema.safeParse({ ids: ['11111111-1111-4111-8111-111111111111'] })
        .success,
    ).toBe(true)
  })
})

describe('정렬 헬퍼', () => {
  const items = normalizeOrder(['a', 'b', 'c'])

  it('should move an item up and renumber from zero', () => {
    // Arrange & Act & Assert
    expect(moveOrder(items, 'c', 'up')).toEqual([
      { id: 'a', sortOrder: 0 },
      { id: 'c', sortOrder: 1 },
      { id: 'b', sortOrder: 2 },
    ])
  })

  it('should return the original array at the edges', () => {
    // Arrange & Act & Assert — 저장할 변경이 없다는 뜻이라 호출부가 참조 동일성으로 판정한다.
    expect(moveOrder(items, 'a', 'up')).toBe(items)
    expect(moveOrder(items, 'c', 'down')).toBe(items)
  })

  it('should detect an actual order change only', () => {
    // Arrange & Act & Assert
    expect(hasOrderChanged(items, normalizeOrder(['a', 'b', 'c']))).toBe(false)
    expect(hasOrderChanged(items, normalizeOrder(['b', 'a', 'c']))).toBe(true)
  })
})
