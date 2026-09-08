import { describe, expect, it } from 'vitest'

import { REPORT_DETAIL_MAX } from '@/lib/constants/report'
import { reportSchema } from '@/lib/validation/report'

const TARGET_ID = '22222222-0000-4000-8000-000000000001'

function input(overrides: Record<string, unknown> = {}) {
  return { targetType: 'post', targetId: TARGET_ID, reason: 'spam', detail: '', ...overrides }
}

describe('reportSchema', () => {
  it('should accept a reason without a detail', () => {
    // Arrange & Act
    const result = reportSchema.safeParse(input())

    // Assert
    expect(result.success).toBe(true)
    expect(result.data?.detail).toBeNull()
  })

  it('should trim the detail and keep it when it has content', () => {
    // Arrange & Act
    const result = reportSchema.safeParse(input({ detail: '  광고 링크가 있습니다  ' }))

    // Assert
    expect(result.data?.detail).toBe('광고 링크가 있습니다')
  })

  it('should treat a whitespace only detail as empty', () => {
    // Arrange & Act
    const result = reportSchema.safeParse(input({ detail: '    ' }))

    // Assert
    expect(result.data?.detail).toBeNull()
  })

  it('should reject a detail longer than the column limit', () => {
    // Arrange — DB 의 char_length(detail) <= 500 체크와 같은 상한
    const detail = 'ㄱ'.repeat(REPORT_DETAIL_MAX + 1)

    // Act
    const result = reportSchema.safeParse(input({ detail }))

    // Assert
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['detail'])
  })

  it('should reject an unknown reason', () => {
    // Arrange & Act
    const result = reportSchema.safeParse(input({ reason: 'because' }))

    // Assert
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('사유')
  })

  it('should reject an unknown target type', () => {
    // Arrange & Act
    const result = reportSchema.safeParse(input({ targetType: 'profile' }))

    // Assert
    expect(result.success).toBe(false)
  })

  it('should reject a target id that is not a uuid', () => {
    // Arrange & Act
    const result = reportSchema.safeParse(input({ targetId: '42' }))

    // Assert
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['targetId'])
  })

  it('should accept every reason the dialog offers', () => {
    // Arrange & Act & Assert
    for (const reason of ['spam', 'abuse', 'obscene', 'privacy', 'other']) {
      expect(reportSchema.safeParse(input({ reason })).success).toBe(true)
    }
  })
})
