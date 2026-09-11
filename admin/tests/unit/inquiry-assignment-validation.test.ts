import { describe, expect, it } from 'vitest'

import {
  INQUIRY_LOCK_TTL_MS,
  inquiryAssigneeParam,
  isLiveLock,
  lockActivityLabel,
  parseInquiryAssignee,
  resolveAssigneeId,
} from '@/lib/validation/inquiry-assignment'
import { parseInquiryFilters } from '@/lib/validation/inquiries'

/**
 * 문의 협업의 입력 계약 — 담당자 필터와 잠금 만료.
 *
 * 고정하려는 것은 둘이다.
 *   1. 주소(`?assignee=`)에 무엇이 실려 와도 질의로 흘러가지 않는다. 모르는 값은
 *      필터를 걸지 않는다(= 전체) — 목록의 다른 필터와 같은 규칙이다.
 *   2. "살아 있는 잠금"의 기준이 **한 곳**에만 있다. 화면마다 만료를 다시 재면
 *      목록에는 '작성 중'이 남고 상세에는 없는 상황이 난다.
 */

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const VIEWER_ID = '22222222-2222-4222-8222-222222222222'

describe('parseInquiryAssignee', () => {
  it('should read the two named filters', () => {
    // Arrange & Act & Assert
    expect(parseInquiryAssignee('me')).toBe('me')
    expect(parseInquiryAssignee('none')).toBe('none')
  })

  it('should accept a uuid as a specific admin', () => {
    // Arrange & Act & Assert
    expect(parseInquiryAssignee(ADMIN_ID)).toEqual({ adminId: ADMIN_ID })
  })

  it('should fall back to all for anything else', () => {
    /* Arrange & Act & Assert — 임의 문자열이 `eq()` 값으로 흘러가면 질의가 깨지거나
       의도치 않은 결과를 낸다. */
    expect(parseInquiryAssignee('admin')).toBe('all')
    expect(parseInquiryAssignee('')).toBe('all')
    expect(parseInquiryAssignee(undefined)).toBe('all')
    expect(parseInquiryAssignee('11111111-1111-4111-8111')).toBe('all')
  })

  it('should take the first value when the key repeats', () => {
    // Arrange & Act & Assert
    expect(parseInquiryAssignee(['none', 'me'])).toBe('none')
  })
})

describe('inquiryAssigneeParam', () => {
  it('should drop the key entirely for the default filter', () => {
    // Arrange & Act & Assert — `buildHref` 규약: null 이면 주소에서 뺀다.
    expect(inquiryAssigneeParam('all')).toBeNull()
  })

  it('should round-trip every other filter', () => {
    // Arrange & Act & Assert
    expect(inquiryAssigneeParam('me')).toBe('me')
    expect(inquiryAssigneeParam('none')).toBe('none')
    expect(inquiryAssigneeParam({ adminId: ADMIN_ID })).toBe(ADMIN_ID)
  })
})

describe('resolveAssigneeId', () => {
  it('should point 내 담당 at the viewer', () => {
    // Arrange & Act & Assert
    expect(resolveAssigneeId('me', VIEWER_ID)).toBe(VIEWER_ID)
  })

  it('should not filter when 내 담당 has no viewer', () => {
    // Arrange & Act & Assert — 남의 큐를 "내 담당"으로 보여 주는 것보다 전체가 낫다.
    expect(resolveAssigneeId('me', null)).toBeNull()
  })

  it('should keep a specific admin regardless of the viewer', () => {
    // Arrange & Act & Assert
    expect(resolveAssigneeId({ adminId: ADMIN_ID }, VIEWER_ID)).toBe(ADMIN_ID)
  })
})

describe('parseInquiryFilters (담당자)', () => {
  it('should carry the assignee filter alongside the existing ones', () => {
    // Arrange & Act
    const filters = parseInquiryFilters({ status: 'open', assignee: 'none', q: '#1024' })

    // Assert
    expect(filters.assignee).toBe('none')
    expect(filters.searchNo).toBe(1024)
  })

  it('should default to all when the parameter is missing', () => {
    // Arrange & Act & Assert
    expect(parseInquiryFilters({}).assignee).toBe('all')
  })
})

describe('isLiveLock', () => {
  const now = Date.parse('2026-09-11T10:00:00.000Z')

  it('should treat a fresh heartbeat as live', () => {
    // Arrange & Act & Assert
    expect(isLiveLock('2026-09-11T09:58:00.000Z', now)).toBe(true)
  })

  it('should expire a heartbeat older than the ttl', () => {
    // Arrange
    const stale = new Date(now - INQUIRY_LOCK_TTL_MS - 1000).toISOString()

    // Act & Assert — DB(`claim_inquiry_edit`)의 5분 기준과 같은 숫자를 쓴다.
    expect(isLiveLock(stale, now)).toBe(false)
  })

  it('should treat a missing or broken timestamp as no lock', () => {
    // Arrange & Act & Assert
    expect(isLiveLock(null, now)).toBe(false)
    expect(isLiveLock('어제', now)).toBe(false)
  })
})

describe('lockActivityLabel', () => {
  const now = Date.parse('2026-09-11T10:00:00.000Z')

  it('should say 방금 for anything under a minute', () => {
    // Arrange & Act & Assert — "0분 전"이라고 적으면 읽는 사람이 멈칫한다.
    expect(lockActivityLabel('2026-09-11T09:59:30.000Z', now)).toBe('방금 활동')
  })

  it('should count whole minutes', () => {
    // Arrange & Act & Assert
    expect(lockActivityLabel('2026-09-11T09:57:00.000Z', now)).toBe('3분 전 활동')
  })

  it('should not pretend to know a missing time', () => {
    // Arrange & Act & Assert
    expect(lockActivityLabel(null, now)).toBe('활동 시각 없음')
  })
})
