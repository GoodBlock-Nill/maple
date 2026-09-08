import { describe, expect, it } from 'vitest'

import {
  describeSuspension,
  isSuspended,
  SUSPENDED_WRITE_MESSAGE,
  suspensionBlockedMessage,
  suspensionNotice,
} from '@/lib/utils/suspension'

/**
 * 정지 안내 문구.
 *
 * `now` 를 인자로 받는 순수 함수라 시간을 고정해 검증한다. 날짜 표기는 Asia/Seoul
 * 기준(`formatDateIso`)이므로 러너의 시간대와 무관하게 같은 결과가 나온다.
 */

const NOW = Date.parse('2026-09-09T00:00:00.000Z')
const UNTIL = '2026-09-11T00:00:00.000Z'
const PERMANENT = '9999-12-31T00:00:00.000Z'

describe('isSuspended', () => {
  it('should treat a future end time as suspended', () => {
    expect(isSuspended(UNTIL, NOW)).toBe(true)
  })

  it('should treat a past end time as not suspended', () => {
    expect(isSuspended('2026-09-08T00:00:00.000Z', NOW)).toBe(false)
  })

  it('should treat null and empty values as not suspended', () => {
    expect(isSuspended(null, NOW)).toBe(false)
    expect(isSuspended('', NOW)).toBe(false)
  })

  it('should treat an unparsable value as not suspended', () => {
    expect(isSuspended('어제', NOW)).toBe(false)
  })
})

describe('describeSuspension', () => {
  it('should state the end date and the reason', () => {
    // Arrange & Act
    const message = describeSuspension(UNTIL, '도배', NOW)

    // Assert
    expect(message).toBe('정지된 계정입니다 (2026-09-11까지 · 사유: 도배)')
  })

  it('should read a far future end time as a permanent suspension', () => {
    expect(describeSuspension(PERMANENT, '욕설·비방', NOW)).toBe(
      '정지된 계정입니다 (영구 정지 · 사유: 욕설·비방)',
    )
  })

  it('should omit the reason when it is missing or blank', () => {
    expect(describeSuspension(UNTIL, null, NOW)).toBe('정지된 계정입니다 (2026-09-11까지)')
    expect(describeSuspension(UNTIL, '   ', NOW)).toBe('정지된 계정입니다 (2026-09-11까지)')
  })

  it('should return null when the suspension has expired or never existed', () => {
    expect(describeSuspension('2026-09-08T00:00:00.000Z', '도배', NOW)).toBeNull()
    expect(describeSuspension(null, '도배', NOW)).toBeNull()
  })

  it('should use the Asia/Seoul calendar day for the end date', () => {
    /* UTC 로는 9월 10일 21시지만 서울에서는 이미 9월 11일 06시다. 사용자가 보는
       달력 날짜로 적어야 "오늘까지인 줄 알았는데 어제였다"가 생기지 않는다. */
    expect(describeSuspension('2026-09-10T21:00:00.000Z', null, NOW)).toBe(
      '정지된 계정입니다 (2026-09-11까지)',
    )
  })
})

describe('suspensionNotice', () => {
  it('should return null for anonymous visitors', () => {
    expect(suspensionNotice(null, NOW)).toBeNull()
  })

  it('should return null for a normal account', () => {
    expect(suspensionNotice({ suspendedUntil: null, suspensionReason: null }, NOW)).toBeNull()
  })

  it('should describe a suspended viewer', () => {
    expect(suspensionNotice({ suspendedUntil: UNTIL, suspensionReason: '도배' }, NOW)).toBe(
      '정지된 계정입니다 (2026-09-11까지 · 사유: 도배)',
    )
  })
})

describe('suspensionBlockedMessage', () => {
  it('should fall back to the period-less notice when the profile looks clean', () => {
    // Arrange — DB 는 42501 로 막았는데 우리가 읽은 프로필은 아직 정지 전인 경우
    const viewer = { suspendedUntil: null, suspensionReason: null }

    // Act & Assert
    expect(suspensionBlockedMessage(viewer, NOW)).toBe(SUSPENDED_WRITE_MESSAGE)
    expect(SUSPENDED_WRITE_MESSAGE).toBe('정지된 계정입니다. 문의는 고객지원에서 접수해 주세요.')
  })

  it('should prefer the known period when the profile already says suspended', () => {
    expect(suspensionBlockedMessage({ suspendedUntil: UNTIL, suspensionReason: '도배' }, NOW)).toBe(
      '정지된 계정입니다 (2026-09-11까지 · 사유: 도배)',
    )
  })
})
