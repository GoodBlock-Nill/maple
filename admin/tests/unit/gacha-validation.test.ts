import { describe, expect, it } from 'vitest'

import { gachaItemSchema, gachaRowsJsonSchema, probabilitySchema } from '@/lib/validation/gacha'

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
