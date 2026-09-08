import { describe, expect, it } from 'vitest'

import { createInquirySchema, validateInquiryAttachments } from '@/lib/validation/inquiry'

const VALID_INPUT = {
  accountId: '123456789000000',
  category: '계정',
  type: '문의',
  title: '로그인이 되지 않습니다',
  content: '어제부터 로그인 화면에서 멈춥니다.',
  consent: true,
}

describe('createInquirySchema', () => {
  it('should accept a fully filled form', () => {
    // Arrange & Act
    const parsed = createInquirySchema.safeParse(VALID_INPUT)

    // Assert
    expect(parsed.success).toBe(true)
    expect(parsed.data?.accountId).toBe('123456789000000')
  })

  it('should turn a blank account id into null', () => {
    // Arrange & Act — DB 컬럼이 nullable 이라 "미입력"은 빈 문자열이 아니라 null 로 간다.
    const parsed = createInquirySchema.safeParse({ ...VALID_INPUT, accountId: '  ' })

    // Assert
    expect(parsed.success).toBe(true)
    expect(parsed.data?.accountId).toBeNull()
  })

  it('should reject an account id that is not a 10~20 digit number', () => {
    // Arrange & Act
    const parsed = createInquirySchema.safeParse({ ...VALID_INPUT, accountId: '12ab' })

    // Assert
    expect(parsed.success).toBe(false)
  })

  it('should reject a category that is not on the list', () => {
    // Arrange & Act
    const parsed = createInquirySchema.safeParse({ ...VALID_INPUT, category: '해킹' })

    // Assert
    expect(parsed.success).toBe(false)
  })

  it('should require the privacy consent', () => {
    // Arrange & Act — DB CHECK(privacy_consent) 보다 앞에서 한국어 문구로 막는다.
    const parsed = createInquirySchema.safeParse({ ...VALID_INPUT, consent: false })

    // Assert
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toContain('동의')
  })

  it('should reject a title that is too short and content that is too long', () => {
    // Arrange & Act
    const shortTitle = createInquirySchema.safeParse({ ...VALID_INPUT, title: '가' })
    const longContent = createInquirySchema.safeParse({
      ...VALID_INPUT,
      content: '가'.repeat(2_001),
    })

    // Assert
    expect(shortTitle.success).toBe(false)
    expect(longContent.success).toBe(false)
  })
})

describe('validateInquiryAttachments', () => {
  const png = { name: 'shot.png', type: 'image/png', size: 1024 }

  it('should accept up to three allowed files', () => {
    // Arrange & Act
    const result = validateInquiryAttachments([png, png, png])

    // Assert
    expect(result.ok).toBe(true)
  })

  it('should reject a fourth file', () => {
    // Arrange & Act
    const result = validateInquiryAttachments([png, png, png, png])

    // Assert — 버킷 제한과 같은 규칙을 앞단에서 한국어로 돌려준다.
    expect(result).toEqual({ ok: false, message: '첨부파일은 최대 3개까지 올릴 수 있습니다.' })
  })

  it('should reject unsupported types', () => {
    // Arrange & Act
    const result = validateInquiryAttachments([
      { name: 'a.zip', type: 'application/zip', size: 10 },
    ])

    // Assert
    expect(result.ok).toBe(false)
  })

  it('should reject empty files', () => {
    // Arrange & Act — 0바이트 오브젝트가 스토리지에 남으면 답변자가 열 수 없다.
    const result = validateInquiryAttachments([{ ...png, size: 0 }])

    // Assert
    expect(result.ok).toBe(false)
  })

  it('should reject files over the bucket limit', () => {
    // Arrange & Act
    const result = validateInquiryAttachments([{ ...png, size: 201 * 1024 * 1024 }])

    // Assert
    expect(result.ok).toBe(false)
  })
})
