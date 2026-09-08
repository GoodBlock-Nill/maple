import { describe, expect, it } from 'vitest'

import {
  defaultLegalVersion,
  deriveLegalStatus,
  formatEffectiveDate,
  isCalendarDate,
  kstToday,
  legalFormSchema,
  resolveLegalPublishPlan,
  selectCurrentLegalVersion,
} from '@/lib/validation/legal'

import type { LegalVersionLike } from '@/lib/validation/legal'

/**
 * 약관은 "언제부터 무엇이 시행 중인가"에 답해야 하는 문서다. 그 판정이 관리자와
 * 사용자 사이트에서 갈리면 운영자는 무엇을 발행했는지 알 수 없다.
 */

/** `2026-09-09 00:30 KST` = `2026-09-08 15:30 UTC`. 날짜가 밀리기 쉬운 시각이다. */
const EARLY_KST = new Date('2026-09-08T15:30:00Z')

describe('kstToday · defaultLegalVersion', () => {
  it('should read the korean calendar day, not the UTC one', () => {
    expect(kstToday(EARLY_KST)).toBe('2026-09-09')
    expect(new Date(EARLY_KST).toISOString().slice(0, 10)).toBe('2026-09-08')
  })

  it('should default the version to the same day without dashes', () => {
    expect(defaultLegalVersion(EARLY_KST)).toBe('20260909')
  })
})

describe('isCalendarDate', () => {
  it('should accept a real date', () => {
    expect(isCalendarDate('2026-02-28')).toBe(true)
  })

  it('should reject a day the calendar does not have', () => {
    expect(isCalendarDate('2026-02-31')).toBe(false)
    expect(isCalendarDate('2026-13-01')).toBe(false)
  })

  it('should reject anything that is not YYYY-MM-DD', () => {
    expect(isCalendarDate('20260218')).toBe(false)
    expect(isCalendarDate('')).toBe(false)
  })
})

describe('formatEffectiveDate', () => {
  it('should match the string the client renders', () => {
    expect(formatEffectiveDate('2026-09-18')).toBe('2026년 9월 18일')
    expect(formatEffectiveDate('2026-01-05')).toBe('2026년 1월 5일')
  })
})

const BASE = {
  summary: '',
  content: '<p>본문</p>',
}

describe('legalFormSchema — 버전', () => {
  it('should accept YYYYMMDD and the same-day suffix', () => {
    for (const version of ['20260918', '20260918-2']) {
      const result = legalFormSchema.safeParse({
        ...BASE,
        version,
        effectiveDate: kstToday(),
        publishMode: 'draft',
      })

      expect(result.success, version).toBe(true)
    }
  })

  it('should reject a free form version', () => {
    const result = legalFormSchema.safeParse({
      ...BASE,
      version: 'v2',
      effectiveDate: kstToday(),
      publishMode: 'draft',
    })

    expect(result.success).toBe(false)
  })
})

describe('legalFormSchema — 시행일과 발행 상태', () => {
  function parse(effectiveDate: string, publishMode: string) {
    return legalFormSchema.safeParse({ ...BASE, version: '20260918', effectiveDate, publishMode })
  }

  /** 오늘 이후. 예약이 성립하는 유일한 조건이다. */
  const FUTURE = '2099-01-01'
  const PAST = '2020-01-01'

  it('should let a draft carry any date', () => {
    expect(parse(FUTURE, 'draft').success).toBe(true)
    expect(parse(PAST, 'draft').success).toBe(true)
  })

  it('should refuse to publish a future dated version', () => {
    expect(parse(FUTURE, 'publish').success).toBe(false)
  })

  it('should refuse to schedule a version that is already effective', () => {
    expect(parse(PAST, 'schedule').success).toBe(false)
    expect(parse(kstToday(), 'schedule').success).toBe(false)
  })

  it('should accept the two combinations that make sense', () => {
    expect(parse(kstToday(), 'publish').success).toBe(true)
    expect(parse(FUTURE, 'schedule').success).toBe(true)
  })

  it('should reject an empty body', () => {
    const result = legalFormSchema.safeParse({
      version: '20260918',
      effectiveDate: kstToday(),
      summary: '',
      content: '',
      publishMode: 'draft',
    })

    expect(result.success).toBe(false)
  })
})

describe('resolveLegalPublishPlan', () => {
  it('should leave a draft unpublished with no timestamp', () => {
    expect(resolveLegalPublishPlan('draft')).toEqual({ isPublished: false, publishedAt: null })
  })

  /* 예약도 `is_published = true` 다. 노출 여부는 시행일 하나가 결정한다. */
  it('should mark both publish and schedule as published', () => {
    for (const mode of ['publish', 'schedule'] as const) {
      const plan = resolveLegalPublishPlan(mode, new Date('2026-09-09T00:00:00Z'))

      expect(plan.isPublished).toBe(true)
      expect(plan.publishedAt).toBe('2026-09-09T00:00:00.000Z')
    }
  })
})

function version(overrides: Partial<LegalVersionLike> & { version: string }): LegalVersionLike {
  return {
    effectiveDate: '2026-09-18',
    isPublished: true,
    publishedAt: '2026-09-08T00:00:00Z',
    ...overrides,
  }
}

/** SQL `current_legal_version()` 과 같은 규칙이어야 한다. */
describe('selectCurrentLegalVersion', () => {
  const TODAY = '2026-09-20'

  it('should pick the latest effective published version', () => {
    const rows = [
      version({ version: '20260918', effectiveDate: '2026-09-18' }),
      version({ version: '20260919', effectiveDate: '2026-09-19' }),
    ]

    expect(selectCurrentLegalVersion(rows, TODAY)?.version).toBe('20260919')
  })

  it('should ignore drafts', () => {
    const rows = [
      version({ version: '20260918' }),
      version({ version: '20260919', effectiveDate: '2026-09-19', isPublished: false }),
    ]

    expect(selectCurrentLegalVersion(rows, TODAY)?.version).toBe('20260918')
  })

  it('should ignore versions whose effective date has not arrived', () => {
    const rows = [
      version({ version: '20260918' }),
      version({ version: '20261001', effectiveDate: '2026-10-01' }),
    ]

    expect(selectCurrentLegalVersion(rows, TODAY)?.version).toBe('20260918')
  })

  it('should break an effective date tie with the later publication', () => {
    const rows = [
      version({ version: '20260918', publishedAt: '2026-09-08T00:00:00Z' }),
      version({ version: '20260918-2', publishedAt: '2026-09-09T00:00:00Z' }),
    ]

    expect(selectCurrentLegalVersion(rows, TODAY)?.version).toBe('20260918-2')
  })

  /* 모두 예약이면 "가장 최근에 발행한 것"으로 떨어진다 — 약관 페이지가 빈 화면이
     되는 것보다 예고본이라도 보이는 편이 낫다. */
  it('should fall back to the latest published version when none is effective yet', () => {
    const rows = [
      version({ version: '20261001', effectiveDate: '2026-10-01', publishedAt: '2026-09-08T00:00:00Z' }),
      version({ version: '20261101', effectiveDate: '2026-11-01', publishedAt: '2026-09-09T00:00:00Z' }),
    ]

    expect(selectCurrentLegalVersion(rows, TODAY)?.version).toBe('20261101')
  })

  it('should return null when nothing is published', () => {
    expect(selectCurrentLegalVersion([version({ version: '1', isPublished: false })], TODAY)).toBeNull()
    expect(selectCurrentLegalVersion([], TODAY)).toBeNull()
  })
})

describe('deriveLegalStatus', () => {
  const TODAY = '2026-09-20'

  it('should name each of the four states', () => {
    expect(deriveLegalStatus(version({ version: 'a', isPublished: false }), 'b', TODAY)).toBe('draft')
    expect(
      deriveLegalStatus(version({ version: 'a', effectiveDate: '2026-10-01' }), 'b', TODAY),
    ).toBe('scheduled')
    expect(deriveLegalStatus(version({ version: 'a' }), 'a', TODAY)).toBe('published')
    expect(deriveLegalStatus(version({ version: 'a' }), 'b', TODAY)).toBe('superseded')
  })
})
