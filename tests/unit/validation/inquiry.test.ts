import { describe, expect, it } from 'vitest'

import {
  createInquirySchema,
  inquiryIdSchema,
  updateInquirySchema,
  validateInquiryAttachments,
} from '@/lib/validation/inquiry'

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

describe('updateInquirySchema', () => {
  it('should accept the same values as 접수 without asking for consent again', () => {
    // Arrange — 동의는 접수 시점에 이미 받아 privacy_consent 로 저장돼 있다.
    const { consent: _consent, ...input } = VALID_INPUT

    // Act
    const parsed = updateInquirySchema.safeParse(input)

    // Assert
    expect(parsed.success).toBe(true)
    expect(parsed.data?.title).toBe(VALID_INPUT.title)
  })

  it('should keep every rule 접수 uses', () => {
    // Arrange & Act — 상한이 갈리면 "접수는 됐는데 수정은 막히는" 문의가 생긴다.
    const shortTitle = updateInquirySchema.safeParse({ ...VALID_INPUT, title: '가' })
    const unknownCategory = updateInquirySchema.safeParse({ ...VALID_INPUT, category: '없는분류' })

    // Assert
    expect(shortTitle.success).toBe(false)
    expect(unknownCategory.success).toBe(false)
  })

  it('should ignore a consent field sent by a direct POST', () => {
    // Arrange & Act — 수정 폼에는 동의 체크박스가 없다. 실려 와도 저장에 쓰지 않는다.
    const parsed = updateInquirySchema.safeParse({ ...VALID_INPUT, consent: false })

    // Assert
    expect(parsed.success).toBe(true)
    expect(parsed.data).not.toHaveProperty('consent')
  })
})

describe('inquiryIdSchema', () => {
  it('should accept a uuid and reject anything else', () => {
    // Arrange & Act & Assert — uuid 가 아닌 id 로 조회하면 postgres 가 22P02 를 던진다.
    expect(inquiryIdSchema.safeParse('33333333-0000-4000-8000-000000000001').success).toBe(true)
    expect(inquiryIdSchema.safeParse('not-a-uuid').success).toBe(false)
  })
})

describe('validateInquiryAttachments with kept files', () => {
  const file = { name: 'shot.png', type: 'image/png', size: 1024 }

  it('should count the attachments kept in the edit form against the limit', () => {
    // Arrange & Act — DB CHECK(inquiries_attachments_max_3)와 같은 한도를 앞단에서 잰다.
    const withinLimit = validateInquiryAttachments([file], 2)
    const overLimit = validateInquiryAttachments([file, file], 2)

    // Assert
    expect(withinLimit.ok).toBe(true)
    expect(overLimit.ok).toBe(false)
  })

  it('should default to counting only the new files', () => {
    // Arrange & Act & Assert — 접수 화면은 남길 첨부가 없다.
    expect(validateInquiryAttachments([file, file, file]).ok).toBe(true)
  })
})
