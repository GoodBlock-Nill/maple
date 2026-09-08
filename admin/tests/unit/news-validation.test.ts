import { describe, expect, it } from 'vitest'

import { toFieldErrors } from '@/lib/actions/form-state'
import { NEWS_SUMMARY_MAX, NEWS_TITLE_MAX } from '@/lib/constants/news'
import {
  isoToKstLocal,
  kstLocalToIso,
  newsFormSchema,
  resolvePublishPlan,
} from '@/lib/validation/news'

/** 통과하는 최소 입력. 각 테스트는 여기서 한 필드만 어긋나게 만든다. */
const VALID = {
  categoryKey: 'notice',
  title: '점검 안내',
  summary: '9월 9일 정기 점검',
  content: '<p>본문</p>',
  publishMode: 'now',
  scheduledAt: '',
  isPinned: false,
}

function errorsOf(input: Record<string, unknown>): Record<string, string> {
  const result = newsFormSchema.safeParse(input)

  expect(result.success).toBe(false)

  return result.success ? {} : toFieldErrors(result.error)
}

describe('newsFormSchema', () => {
  it('should accept a minimal valid form', () => {
    expect(newsFormSchema.safeParse(VALID).success).toBe(true)
  })

  it('should reject a category outside the allow list', () => {
    expect(errorsOf({ ...VALID, categoryKey: 'chat' }).categoryKey).toBe('카테고리를 선택해 주세요.')
  })

  it('should require a title', () => {
    expect(errorsOf({ ...VALID, title: '   ' }).title).toBe('제목을 입력해 주세요.')
  })

  it(`should reject a title longer than ${NEWS_TITLE_MAX} characters`, () => {
    expect(newsFormSchema.safeParse({ ...VALID, title: 'ㄱ'.repeat(NEWS_TITLE_MAX) }).success).toBe(
      true,
    )
    expect(errorsOf({ ...VALID, title: 'ㄱ'.repeat(NEWS_TITLE_MAX + 1) }).title).toContain(
      String(NEWS_TITLE_MAX),
    )
  })

  it('should allow an empty summary but cap its length', () => {
    expect(newsFormSchema.safeParse({ ...VALID, summary: '' }).success).toBe(true)
    expect(errorsOf({ ...VALID, summary: 'ㄱ'.repeat(NEWS_SUMMARY_MAX + 1) }).summary).toContain(
      String(NEWS_SUMMARY_MAX),
    )
  })

  it('should require a body', () => {
    expect(errorsOf({ ...VALID, content: '' }).content).toBe('본문을 입력해 주세요.')
  })

  it('should require a time when scheduling', () => {
    const errors = errorsOf({ ...VALID, publishMode: 'schedule', scheduledAt: '' })

    expect(errors.scheduledAt).toBe('예약 발행 시각을 입력해 주세요.')
  })

  it('should reject a malformed schedule value', () => {
    const errors = errorsOf({ ...VALID, publishMode: 'schedule', scheduledAt: '내일 3시' })

    expect(errors.scheduledAt).toBe('예약 시각 형식이 올바르지 않습니다.')
  })

  it('should reject a schedule in the past', () => {
    const errors = errorsOf({
      ...VALID,
      publishMode: 'schedule',
      scheduledAt: '2020-01-01T09:00',
    })

    expect(errors.scheduledAt).toBe('예약 시각은 현재보다 뒤여야 합니다.')
  })

  it('should accept a schedule in the future', () => {
    const future = isoToKstLocal(new Date(Date.now() + 60 * 60 * 1000).toISOString())
    const result = newsFormSchema.safeParse({
      ...VALID,
      publishMode: 'schedule',
      scheduledAt: future,
    })

    expect(result.success).toBe(true)
  })

  it('should ignore the schedule value in the other modes', () => {
    const result = newsFormSchema.safeParse({
      ...VALID,
      publishMode: 'draft',
      scheduledAt: '2020-01-01T09:00',
    })

    expect(result.success).toBe(true)
  })
})

describe('kstLocalToIso', () => {
  it('should read the wall clock as Korea time, not the runtime timezone', () => {
    expect(kstLocalToIso('2026-09-08T17:30')).toBe('2026-09-08T08:30:00.000Z')
  })

  it('should round trip through isoToKstLocal', () => {
    expect(isoToKstLocal('2026-09-08T08:30:00.000Z')).toBe('2026-09-08T17:30')
  })

  it('should reject a date that does not exist', () => {
    expect(kstLocalToIso('2026-02-31T09:00')).toBeNull()
  })

  it('should reject values that are not datetime-local strings', () => {
    expect(kstLocalToIso('')).toBeNull()
    expect(kstLocalToIso('2026-09-08')).toBeNull()
    expect(kstLocalToIso('2026-09-08 17:30')).toBeNull()
  })
})

describe('resolvePublishPlan', () => {
  const NOW = new Date('2026-09-08T00:00:00.000Z')

  it('should keep a post unpublished in draft mode', () => {
    const plan = resolvePublishPlan({ publishMode: 'draft', scheduledAt: '' }, null, NOW)

    expect(plan).toEqual({ isPublished: false, publishedAt: NOW.toISOString() })
  })

  it('should keep the original publish time when a draft had one', () => {
    const plan = resolvePublishPlan(
      { publishMode: 'draft', scheduledAt: '' },
      { isPublished: true, publishedAt: '2026-01-01T00:00:00.000Z' },
      NOW,
    )

    expect(plan.publishedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('should publish new posts at the current time', () => {
    const plan = resolvePublishPlan({ publishMode: 'now', scheduledAt: '' }, null, NOW)

    expect(plan).toEqual({ isPublished: true, publishedAt: NOW.toISOString() })
  })

  it('should not bump the publish date of an already published post', () => {
    const plan = resolvePublishPlan(
      { publishMode: 'now', scheduledAt: '' },
      { isPublished: true, publishedAt: '2026-01-01T00:00:00.000Z' },
      NOW,
    )

    expect(plan.publishedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('should move a scheduled post to now when published immediately', () => {
    const plan = resolvePublishPlan(
      { publishMode: 'now', scheduledAt: '' },
      { isPublished: true, publishedAt: '2027-01-01T00:00:00.000Z' },
      NOW,
    )

    expect(plan.publishedAt).toBe(NOW.toISOString())
  })

  it('should convert the scheduled wall clock to UTC', () => {
    const plan = resolvePublishPlan(
      { publishMode: 'schedule', scheduledAt: '2026-12-25T09:00' },
      null,
      NOW,
    )

    expect(plan).toEqual({ isPublished: true, publishedAt: '2026-12-25T00:00:00.000Z' })
  })
})
