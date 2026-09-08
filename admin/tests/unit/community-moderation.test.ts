import { describe, expect, it } from 'vitest'

import {
  bulkHideSchema,
  BULK_HIDE_MAX,
  containsPattern,
  contentStatus,
  CONTENT_STATUS_LABEL,
  dismissReportSchema,
  kstDayBoundary,
  MODERATION_NOTE_MAX,
  REPORT_REASON_LABEL,
  resolveReportSchema,
  toggleContentSchema,
} from '@/lib/validation/moderation'

const ID = '22222222-2222-4222-8222-222222222222'

describe('contentStatus', () => {
  it('should report a normal row as visible', () => {
    expect(contentStatus({ isHidden: false, deletedAt: null })).toBe('visible')
  })

  it('should report an operator-hidden row as hidden', () => {
    expect(contentStatus({ isHidden: true, deletedAt: null })).toBe('hidden')
  })

  it('should let deletion win over hiding', () => {
    // 둘 다 서 있으면 "복구"가 필요한 상태다. 숨김으로 보이면 운영자가 헛손질한다.
    expect(contentStatus({ isHidden: true, deletedAt: '2026-09-08T00:00:00Z' })).toBe('deleted')
    expect(CONTENT_STATUS_LABEL.deleted).toBe('삭제')
  })
})

describe('containsPattern', () => {
  it('should wrap the term with wildcards', () => {
    expect(containsPattern('모험가')).toBe('%모험가%')
  })

  it('should escape ilike wildcards in user input', () => {
    expect(containsPattern('100%_할인')).toBe('%100\\%\\_할인%')
  })

  it('should return null for empty input', () => {
    expect(containsPattern('')).toBeNull()
    expect(containsPattern('   ')).toBeNull()
    expect(containsPattern(null)).toBeNull()
  })
})

describe('kstDayBoundary', () => {
  it('should turn a KST day into the matching UTC instant', () => {
    // 한국시간 자정 = 전날 15:00 UTC.
    expect(kstDayBoundary('2026-09-08')).toBe('2026-09-07T15:00:00.000Z')
  })

  it('should support the exclusive end of a range', () => {
    expect(kstDayBoundary('2026-09-08', 1)).toBe('2026-09-08T15:00:00.000Z')
  })

  it('should return null for missing or malformed days', () => {
    expect(kstDayBoundary(null)).toBeNull()
    expect(kstDayBoundary('어제')).toBeNull()
  })
})

describe('toggleContentSchema', () => {
  it('should turn the string flag into a boolean', () => {
    expect(toggleContentSchema.parse({ id: ID, on: '1' }).on).toBe(true)
    expect(toggleContentSchema.parse({ id: ID, on: '0' }).on).toBe(false)
  })

  it('should reject anything but the two known flags', () => {
    expect(toggleContentSchema.safeParse({ id: ID, on: 'true' }).success).toBe(false)
  })
})

describe('bulkHideSchema', () => {
  it('should require at least one target', () => {
    expect(bulkHideSchema.safeParse({ ids: [] }).success).toBe(false)
  })

  it('should cap a single batch', () => {
    const ids = Array.from({ length: BULK_HIDE_MAX + 1 }, () => ID)

    expect(bulkHideSchema.safeParse({ ids }).success).toBe(false)
  })

  it('should accept a batch inside the cap', () => {
    expect(bulkHideSchema.safeParse({ ids: [ID, ID] }).success).toBe(true)
  })
})

describe('resolveReportSchema', () => {
  const base = { reportId: ID, action: 'hide', note: '', applyToTarget: '0' }

  it('should treat an empty note as no note', () => {
    expect(resolveReportSchema.parse(base).note).toBeNull()
  })

  it('should reject a note longer than the limit', () => {
    const parsed = resolveReportSchema.safeParse({
      ...base,
      note: 'ㄱ'.repeat(MODERATION_NOTE_MAX + 1),
    })

    expect(parsed.success).toBe(false)
  })

  it('should accept a note exactly at the limit', () => {
    const parsed = resolveReportSchema.safeParse({
      ...base,
      note: 'ㄱ'.repeat(MODERATION_NOTE_MAX),
    })

    expect(parsed.success).toBe(true)
  })

  it('should require a period and a reason when suspending', () => {
    const missing = resolveReportSchema.safeParse({ ...base, action: 'suspend' })

    expect(missing.success).toBe(false)
    expect(missing.error?.issues.map((issue) => issue.path[0])).toEqual([
      'period',
      'suspensionReason',
    ])

    const complete = resolveReportSchema.safeParse({
      ...base,
      action: 'suspend',
      period: '3',
      suspensionReason: '욕설 반복',
    })

    expect(complete.success).toBe(true)
  })

  it('should not ask for suspension fields for other actions', () => {
    expect(resolveReportSchema.safeParse({ ...base, action: 'none' }).success).toBe(true)
  })

  it('should turn the batch flag into a boolean', () => {
    expect(resolveReportSchema.parse({ ...base, applyToTarget: '1' }).applyToTarget).toBe(true)
  })
})

describe('dismissReportSchema', () => {
  it('should require a note', () => {
    expect(dismissReportSchema.safeParse({ reportId: ID, note: '  ', applyToTarget: '0' }).success).toBe(
      false,
    )
  })

  it('should accept a dismissal with a reason', () => {
    const parsed = dismissReportSchema.safeParse({
      reportId: ID,
      note: '정상 게시물',
      applyToTarget: '0',
    })

    expect(parsed.success).toBe(true)
    expect(parsed.data?.note).toBe('정상 게시물')
  })
})

describe('REPORT_REASON_LABEL', () => {
  it('should match the wording used by the user site report dialog', () => {
    /* 사용자 사이트 `lib/constants/report.ts` 의 REPORT_REASONS 와 같은 문자열이어야
       한다. 다르면 같은 신고를 두고 운영자와 신고자가 다른 단어를 쓰게 된다. */
    expect(REPORT_REASON_LABEL).toEqual({
      spam: '스팸·광고',
      abuse: '욕설·비방',
      obscene: '음란·불쾌',
      privacy: '개인정보 노출',
      other: '기타',
    })
  })
})
