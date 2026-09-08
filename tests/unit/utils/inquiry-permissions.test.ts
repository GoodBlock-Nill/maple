import { describe, expect, it } from 'vitest'

import {
  canCancelInquiry,
  canEditInquiry,
  isInquiryCancelled,
} from '@/lib/utils/inquiry-permissions'

import type { InquiryStatus } from '@/types/domain'

const CANCELLED_AT = '2026-09-08T02:00:00.000Z'

/** DB enum(`inquiry_status`) 전부. 새 값이 늘면 이 배열이 먼저 깨져야 한다. */
const STATUSES: readonly InquiryStatus[] = ['pending', 'in_progress', 'answered', 'closed']

describe('canEditInquiry', () => {
  it('should allow editing only while the inquiry is pending', () => {
    // Arrange & Act
    const editable = STATUSES.filter((status) => canEditInquiry({ status, cancelledAt: null }))

    // Assert — 처리 중 이후에 본문이 바뀌면 답변의 근거가 사라진다.
    expect(editable).toEqual(['pending'])
  })

  it('should refuse to edit a cancelled inquiry even when it is still pending', () => {
    // Arrange & Act & Assert
    expect(canEditInquiry({ status: 'pending', cancelledAt: CANCELLED_AT })).toBe(false)
  })
})

describe('canCancelInquiry', () => {
  it('should allow cancelling while pending or in progress', () => {
    // Arrange & Act
    const cancellable = STATUSES.filter((status) => canCancelInquiry({ status, cancelledAt: null }))

    // Assert — 답변이 등록된 뒤(answered)나 이미 끝난 문의는 취소할 것이 없다.
    expect(cancellable).toEqual(['pending', 'in_progress'])
  })

  it('should never allow cancelling twice', () => {
    // Arrange & Act & Assert — 되돌리기가 없으므로 두 번째 취소는 의미가 없다.
    expect(canCancelInquiry({ status: 'pending', cancelledAt: CANCELLED_AT })).toBe(false)
    expect(canCancelInquiry({ status: 'in_progress', cancelledAt: CANCELLED_AT })).toBe(false)
  })
})

describe('isInquiryCancelled', () => {
  it('should treat only a real timestamp as cancelled', () => {
    // Arrange & Act & Assert — null·undefined·빈 문자열은 "취소되지 않음"이다.
    expect(isInquiryCancelled(CANCELLED_AT)).toBe(true)
    expect(isInquiryCancelled(null)).toBe(false)
    expect(isInquiryCancelled(undefined)).toBe(false)
    expect(isInquiryCancelled('')).toBe(false)
  })
})
