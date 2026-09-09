import { describe, expect, it } from 'vitest'

import {
  authorLabel,
  isPurgedAuthorName,
  PURGED_AUTHOR_LABEL,
  PURGED_NICKNAME_PREFIX,
} from '@/lib/utils/author-display'
import { nicknameSchema } from '@/lib/validation/auth'

describe('isPurgedAuthorName', () => {
  it('should recognise the anonymized nickname the purge function writes', () => {
    expect(isPurgedAuthorName('탈퇴한 회원#3f2a9c1d')).toBe(true)
  })

  it('should not match ordinary nicknames or empty values', () => {
    expect(isPurgedAuthorName('cinnamon')).toBe(false)
    expect(isPurgedAuthorName('탈퇴한회원')).toBe(false)
    expect(isPurgedAuthorName(null)).toBe(false)
    expect(isPurgedAuthorName(undefined)).toBe(false)
  })

  it('should rely on a prefix no real member can register', () => {
    // 닉네임 규칙(한글·영문·숫자·밑줄)상 공백과 '#' 은 쓸 수 없다 — 접두사 충돌이 불가능하다.
    expect(nicknameSchema.safeParse(PURGED_NICKNAME_PREFIX).success).toBe(false)
    expect(nicknameSchema.safeParse('탈퇴한 회원').success).toBe(false)
  })
})

describe('authorLabel', () => {
  it('should show the fixed label without masking for a purged author', () => {
    // Arrange
    const source = { author: '탈퇴한 회원#3f2a9c1d', authorPurged: true }

    // Act
    const label = authorLabel(source)

    // Assert
    expect(label).toBe(PURGED_AUTHOR_LABEL)
    expect(label).toBe('탈퇴한 회원')
  })

  it('should keep the masked nickname for an active or withdrawn (not yet purged) author', () => {
    // 탈퇴 대기 중에는 스냅샷이 그대로라 기존 마스킹이 보인다(오너 결정 3).
    expect(authorLabel({ author: 'cinnamon', authorPurged: false })).toBe('cin***')
  })
})
