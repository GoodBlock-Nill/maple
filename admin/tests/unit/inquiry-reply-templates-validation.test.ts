import { describe, expect, it } from 'vitest'

import { INQUIRY_REPLY_MAX_LENGTH } from '@/lib/validation/inquiries'
import {
  COMMON_CATEGORY_VALUE,
  INQUIRY_REPLY_TEMPLATE_BODY_MAX,
  INQUIRY_REPLY_TEMPLATE_NAME_MAX,
  inquiryReplyTemplateReorderSchema,
  inquiryReplyTemplateSchema,
  toCategoryId,
} from '@/lib/validation/inquiry-reply-templates'

/**
 * 답변 템플릿 입력 계약.
 *
 * 상한은 DB CHECK(`inquiry_reply_templates_name_length` · `_body_length`, 마이그레이션
 * 20260911000200)와 **같은 숫자**여야 한다. 어긋나면 화면이 통과시킨 값이 저장에서
 * 23514 로 떨어져 운영자는 이유를 알 수 없는 실패를 본다.
 */

const CATEGORY_ID = '33333333-3333-4333-8333-333333333333'

const VALID = {
  categoryId: COMMON_CATEGORY_VALUE,
  name: '접수 확인 안내',
  body: '안녕하세요, {{닉네임}}님.',
  isActive: true,
}

describe('inquiryReplyTemplateSchema', () => {
  it('should keep the body limit equal to the reply field limit', () => {
    // 불러온 문안이 그대로 답변으로 저장된다. 여기가 더 관대하면 "불러왔는데 등록할 수
    // 없는" 템플릿이 만들어진다.
    expect(INQUIRY_REPLY_TEMPLATE_BODY_MAX).toBe(INQUIRY_REPLY_MAX_LENGTH)
  })

  it('should accept a common template with an empty category', () => {
    // Arrange & Act
    const result = inquiryReplyTemplateSchema.safeParse(VALID)

    // Assert
    expect(result.success).toBe(true)
    expect(toCategoryId(result.data!.categoryId)).toBeNull()
  })

  it('should accept a category template and keep its id', () => {
    // Arrange & Act
    const result = inquiryReplyTemplateSchema.safeParse({ ...VALID, categoryId: CATEGORY_ID })

    // Assert
    expect(result.success).toBe(true)
    expect(toCategoryId(result.data!.categoryId)).toBe(CATEGORY_ID)
  })

  it('should reject a category that is not a uuid', () => {
    // Arrange & Act — 직접 POST 로 들어오는 값이라 화면 셀렉트를 믿지 않는다.
    const result = inquiryReplyTemplateSchema.safeParse({ ...VALID, categoryId: 'connection' })

    // Assert
    expect(result.success).toBe(false)
  })

  it('should normalise CRLF and trim the body', () => {
    // Arrange & Act
    const result = inquiryReplyTemplateSchema.safeParse({
      ...VALID,
      body: '  첫 줄\r\n둘째 줄\r  ',
    })

    // Assert
    expect(result.data?.body).toBe('첫 줄\n둘째 줄')
  })

  it('should reject an empty name and an empty body', () => {
    // Arrange & Act
    const blankName = inquiryReplyTemplateSchema.safeParse({ ...VALID, name: '   ' })
    const blankBody = inquiryReplyTemplateSchema.safeParse({ ...VALID, body: '\n\n' })

    // Assert
    expect(blankName.error?.issues[0]?.message).toContain('이름')
    expect(blankBody.error?.issues[0]?.message).toContain('내용')
  })

  it('should reject values over the database limits', () => {
    // Arrange
    const longName = 'ㄱ'.repeat(INQUIRY_REPLY_TEMPLATE_NAME_MAX + 1)
    const longBody = 'ㄴ'.repeat(INQUIRY_REPLY_TEMPLATE_BODY_MAX + 1)

    // Act
    const nameResult = inquiryReplyTemplateSchema.safeParse({ ...VALID, name: longName })
    const bodyResult = inquiryReplyTemplateSchema.safeParse({ ...VALID, body: longBody })

    // Assert
    expect(nameResult.error?.issues[0]?.message).toContain(`${INQUIRY_REPLY_TEMPLATE_NAME_MAX}자`)
    expect(bodyResult.error?.issues[0]?.message).toContain(`${INQUIRY_REPLY_TEMPLATE_BODY_MAX}자`)
  })

  it('should accept values exactly at the limits', () => {
    // Arrange & Act — 경계값은 통과해야 한다(DB CHECK 가 between 이다).
    const result = inquiryReplyTemplateSchema.safeParse({
      ...VALID,
      name: '가'.repeat(INQUIRY_REPLY_TEMPLATE_NAME_MAX),
      body: '나'.repeat(INQUIRY_REPLY_TEMPLATE_BODY_MAX),
    })

    // Assert
    expect(result.success).toBe(true)
  })
})

describe('inquiryReplyTemplateReorderSchema', () => {
  it('should require at least one id', () => {
    // Arrange & Act
    const result = inquiryReplyTemplateReorderSchema.safeParse({ ids: [] })

    // Assert
    expect(result.success).toBe(false)
  })

  it('should reject ids that are not uuids', () => {
    // Arrange & Act
    const result = inquiryReplyTemplateReorderSchema.safeParse({ ids: [CATEGORY_ID, 'nope'] })

    // Assert
    expect(result.success).toBe(false)
  })
})
