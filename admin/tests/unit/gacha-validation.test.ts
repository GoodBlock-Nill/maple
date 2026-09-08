import { describe, expect, it } from 'vitest'

import {
  gachaCsvRowSchema,
  gachaItemSchema,
  gachaRowsJsonSchema,
  probabilitySchema,
} from '@/lib/validation/gacha'

describe('probabilitySchema', () => {
  it('should accept three decimal places', () => {
    expect(probabilitySchema.parse('1.234')).toBe(1.234)
  })

  it('should accept the boundaries 0 and 100', () => {
    expect(probabilitySchema.parse('0')).toBe(0)
    expect(probabilitySchema.parse('100')).toBe(100)
  })

  it('should reject a fourth decimal place', () => {
    // numeric(6,3) 이라 넷째 자리는 DB 에서 조용히 반올림된다. 입력에서 막는다.
    const result = probabilitySchema.safeParse('1.2345')

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('소수점 3자리')
  })

  it('should reject values above 100', () => {
    expect(probabilitySchema.safeParse('100.001').success).toBe(false)
  })

  it('should reject an empty string instead of coercing it to zero', () => {
    expect(probabilitySchema.safeParse('').success).toBe(false)
  })

  it('should reject exponent and thousands notation', () => {
    expect(probabilitySchema.safeParse('1e2').success).toBe(false)
    expect(probabilitySchema.safeParse('1,5').success).toBe(false)
  })

  it('should trim surrounding whitespace', () => {
    expect(probabilitySchema.parse('  2.5 ')).toBe(2.5)
  })
})

describe('gachaRowsJsonSchema', () => {
  it('should treat an empty string as no rows', () => {
    expect(gachaRowsJsonSchema.parse('')).toEqual([])
  })

  it('should parse a grade table and default the note', () => {
    const rows = gachaRowsJsonSchema.parse(
      '[{"grade":"SS","itemName":"펫","itemIcon":"/a.png","probability":"0.05"}]',
    )

    expect(rows).toEqual([
      { grade: 'SS', itemName: '펫', itemIcon: '/a.png', probability: '0.05', note: '-' },
    ])
  })

  it('should reject an unknown grade', () => {
    expect(
      gachaRowsJsonSchema.safeParse(
        '[{"grade":"AAA","itemName":"펫","itemIcon":"","probability":"1"}]',
      ).success,
    ).toBe(false)
  })

  it('should reject malformed JSON', () => {
    expect(gachaRowsJsonSchema.safeParse('[{').success).toBe(false)
  })
})

describe('gachaItemSchema', () => {
  const base = {
    tab: 'premium',
    name: '프리미엄 부화기 12차',
    iconUrl: '/images/guide/icon-item-1.png',
    probability: '1.234',
    rows: [],
    isPublished: true,
    publishedAt: '2026-09-08T10:00',
  }

  it('should accept a complete item', () => {
    expect(gachaItemSchema.parse(base).probability).toBe(1.234)
  })

  it('should accept an empty icon', () => {
    expect(gachaItemSchema.parse({ ...base, iconUrl: '' }).iconUrl).toBe('')
  })

  it('should reject an icon that is neither a URL nor a rooted path', () => {
    expect(gachaItemSchema.safeParse({ ...base, iconUrl: 'images/a.png' }).success).toBe(false)
  })

  it('should reject an unknown tab', () => {
    expect(gachaItemSchema.safeParse({ ...base, tab: 'legendary' }).success).toBe(false)
  })

  it('should reject a blank name', () => {
    expect(gachaItemSchema.safeParse({ ...base, name: '   ' }).success).toBe(false)
  })
})

describe('gachaCsvRowSchema', () => {
  const row = {
    id: '',
    tab: 'scroll',
    name: '주문서 부화기 7차',
    icon_url: '',
    probability: '3.180',
    is_published: 'true',
    published_at: '2026-04-16T10:00:00.000Z',
    rows: '[]',
  }

  it('should parse a row exported by the admin console', () => {
    const parsed = gachaCsvRowSchema.parse(row)

    expect(parsed).toMatchObject({ tab: 'scroll', probability: 3.18, is_published: true })
    expect(parsed.published_at).toBe('2026-04-16T10:00:00.000Z')
  })

  it('should accept Korean and numeric spellings of the published flag', () => {
    expect(gachaCsvRowSchema.parse({ ...row, is_published: '공개' }).is_published).toBe(true)
    expect(gachaCsvRowSchema.parse({ ...row, is_published: '0' }).is_published).toBe(false)
    // 빈 값은 "비공개"로 본다 — 실수로 공개되는 쪽이 더 위험하다.
    expect(gachaCsvRowSchema.parse({ ...row, is_published: '' }).is_published).toBe(false)
  })

  it('should turn an empty published_at into null so the action can fill it', () => {
    expect(gachaCsvRowSchema.parse({ ...row, published_at: '' }).published_at).toBeNull()
  })

  it('should reject an id that is not a UUID', () => {
    expect(gachaCsvRowSchema.safeParse({ ...row, id: '12' }).success).toBe(false)
  })

  it('should reject an unparsable date', () => {
    expect(gachaCsvRowSchema.safeParse({ ...row, published_at: '어제' }).success).toBe(false)
  })

  it('should default optional columns when they are missing entirely', () => {
    const parsed = gachaCsvRowSchema.parse({ tab: 'cube', name: '큐브', probability: '10', id: '' })

    expect(parsed).toMatchObject({ icon_url: '', is_published: true, rows: [] })
    expect(parsed.published_at).toBeNull()
  })
})
