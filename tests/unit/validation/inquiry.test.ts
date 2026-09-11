import { describe, expect, it } from 'vitest'

import {
  INQUIRY_ATTACHMENT_MAX_BYTES,
  INQUIRY_ATTACHMENT_MAX_MB,
  INQUIRY_ATTACHMENT_MAX_TOTAL,
  INQUIRY_ATTACHMENT_TOTAL_MAX_BYTES,
  INQUIRY_ATTACHMENT_TOTAL_MAX_MB,
  INQUIRY_FILE_MAX_COUNT,
  SERVER_ACTION_BODY_SIZE_LIMIT,
} from '@/lib/supabase/storage'
import {
  ACCOUNT_ID_MAX,
  createInquirySchema,
  INQUIRY_ATTACHMENT_ACCEPT,
  INQUIRY_CONTENT_MAX,
  inquiryIdSchema,
  isInquiryFormFilled,
  normalizeCRLF,
  updateInquirySchema,
  validateInquiryAttachments,
} from '@/lib/validation/inquiry'

import { INQUIRY_SUBTYPE_FALLBACK } from '@/lib/utils/inquiry-subtypes'

import type { InquiryCategoryChoice } from '@/lib/utils/inquiry-subtypes'

/** `next.config.ts` 가 넘기는 문자열(`'14mb'`)을 바이트로 되돌린다. */
function bodyLimitBytes(): number {
  const match = /^(\d+)mb$/u.exec(SERVER_ACTION_BODY_SIZE_LIMIT)

  return Number(match?.[1] ?? 0) * 1024 * 1024
}

/**
 * 활성 카테고리는 DB 가 소유한다. 스키마는 호출 시점에 이 목록(라벨 + 그 카테고리의
 * 세부 문의 유형)을 받아 만들어진다.
 */
const CATEGORIES: readonly InquiryCategoryChoice[] = [
  { label: '접속·서버', subtypes: ['로그인/접속 불가', '강제 종료', '지연/서버 장애'] },
  { label: '캐릭터·게임 진행', subtypes: ['퀘스트/콘텐츠 진행 불가', '보상 획득 오류'] },
  /* 세부 유형이 없는 카테고리. 폼이 hidden 으로 싣는 '기타' 만 받는다. */
  { label: '기타·건의', subtypes: [] },
]

const VALID_INPUT = {
  accountId: '123456789000000',
  category: '접속·서버',
  type: '로그인/접속 불가',
  title: '로그인이 되지 않습니다',
  content: '어제부터 로그인 화면에서 멈춥니다.',
  consent: true,
}

describe('createInquirySchema', () => {
  it('should accept a fully filled form', () => {
    // Arrange & Act
    const parsed = createInquirySchema(CATEGORIES).safeParse(VALID_INPUT)

    // Assert
    expect(parsed.success).toBe(true)
    expect(parsed.data?.accountId).toBe('123456789000000')
  })

  it('should require the account id', () => {
    // Arrange & Act — 2026-09-11 부터 필수다(본인 확인 없이 답할 수 있는 문의가 없다).
    const parsed = createInquirySchema(CATEGORIES).safeParse({ ...VALID_INPUT, accountId: '  ' })

    // Assert
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toContain('계정 ID')
  })

  it('should trim the account id and keep letters, digits, _ and -', () => {
    // Arrange & Act — 클라이언트가 보여 주는 ID 서식을 숫자로 굳히지 않는다.
    const parsed = createInquirySchema(CATEGORIES).safeParse({
      ...VALID_INPUT,
      accountId: ' msw_user-01 ',
    })

    // Assert
    expect(parsed.success).toBe(true)
    expect(parsed.data?.accountId).toBe('msw_user-01')
  })

  it('should reject an account id with spaces or symbols', () => {
    // Arrange & Act
    const spaced = createInquirySchema(CATEGORIES).safeParse({
      ...VALID_INPUT,
      accountId: '2012 3456',
    })
    const symbol = createInquirySchema(CATEGORIES).safeParse({
      ...VALID_INPUT,
      accountId: '2012@3456',
    })

    // Assert
    expect(spaced.success).toBe(false)
    expect(symbol.success).toBe(false)
  })

  it('should reject an account id outside 2~40 characters', () => {
    // Arrange & Act — 상한은 DB CHECK(inquiries_account_id_length)와 같은 숫자다.
    const tooShort = createInquirySchema(CATEGORIES).safeParse({ ...VALID_INPUT, accountId: '1' })
    const tooLong = createInquirySchema(CATEGORIES).safeParse({
      ...VALID_INPUT,
      accountId: '2'.repeat(ACCOUNT_ID_MAX + 1),
    })

    // Assert
    expect(tooShort.success).toBe(false)
    expect(tooLong.success).toBe(false)
  })

  it('should reject a category that is not on the list', () => {
    // Arrange & Act
    const parsed = createInquirySchema(CATEGORIES).safeParse({ ...VALID_INPUT, category: '해킹' })

    // Assert
    expect(parsed.success).toBe(false)
  })

  it('should reject a subtype that belongs to another category', () => {
    // Arrange & Act — 화면에서는 만들 수 없는 조합이지만 직접 POST 로는 들어온다.
    const parsed = createInquirySchema(CATEGORIES).safeParse({
      ...VALID_INPUT,
      type: '보상 획득 오류',
    })

    // Assert
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.path).toEqual(['type'])
    expect(parsed.error?.issues[0]?.message).toContain('세부 문의 유형')
  })

  it('should reject an empty subtype', () => {
    // Arrange & Act
    const parsed = createInquirySchema(CATEGORIES).safeParse({ ...VALID_INPUT, type: '' })

    // Assert
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toContain('세부 문의 유형')
  })

  it('should reject the legacy 3-type values', () => {
    // Arrange & Act — 옛 '문의 · 신고 · 제안' 은 어느 카테고리의 세부 유형도 아니다.
    const parsed = createInquirySchema(CATEGORIES).safeParse({ ...VALID_INPUT, type: '문의' })

    // Assert
    expect(parsed.success).toBe(false)
  })

  it('should accept the fallback subtype for a category with no subtypes', () => {
    // Arrange & Act — 폼이 셀렉트를 잠그고 hidden 으로 싣는 값이 그대로 통과해야 한다.
    const parsed = createInquirySchema(CATEGORIES).safeParse({
      ...VALID_INPUT,
      category: '기타·건의',
      type: INQUIRY_SUBTYPE_FALLBACK,
    })

    // Assert
    expect(parsed.success).toBe(true)
  })

  it('should reject a real subtype for a category with no subtypes', () => {
    // Arrange & Act — 세부 유형이 없는 카테고리에서는 폴백 말고 아무것도 받지 않는다.
    const parsed = createInquirySchema(CATEGORIES).safeParse({
      ...VALID_INPUT,
      category: '기타·건의',
      type: '강제 종료',
    })

    // Assert
    expect(parsed.success).toBe(false)
  })

  it('should require the privacy consent', () => {
    // Arrange & Act — DB CHECK(privacy_consent) 보다 앞에서 한국어 문구로 막는다.
    const parsed = createInquirySchema(CATEGORIES).safeParse({ ...VALID_INPUT, consent: false })

    // Assert
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toContain('동의')
  })

  it('should reject a title that is too short and content that is too long', () => {
    // Arrange & Act
    const shortTitle = createInquirySchema(CATEGORIES).safeParse({ ...VALID_INPUT, title: '가' })
    const longContent = createInquirySchema(CATEGORIES).safeParse({
      ...VALID_INPUT,
      content: '가'.repeat(INQUIRY_CONTENT_MAX + 1),
    })

    // Assert
    expect(shortTitle.success).toBe(false)
    expect(longContent.success).toBe(false)
  })
})

describe('normalizeCRLF', () => {
  it('should turn CRLF into LF', () => {
    // Arrange & Act — 브라우저가 textarea 값을 전송 시 CRLF 로 정규화한다(HTML 사양).
    const result = normalizeCRLF('첫 줄\r\n둘째 줄\r\n셋째 줄')

    // Assert
    expect(result).toBe('첫 줄\n둘째 줄\n셋째 줄')
  })

  it('should also turn a lone CR into LF', () => {
    // Arrange & Act — 구형 클라이언트/직접 POST 가 CR 만 보낼 수도 있다.
    const result = normalizeCRLF('첫 줄\r둘째 줄')

    // Assert
    expect(result).toBe('첫 줄\n둘째 줄')
  })

  it('should leave LF-only text untouched', () => {
    // Arrange & Act
    const result = normalizeCRLF('첫 줄\n둘째 줄')

    // Assert
    expect(result).toBe('첫 줄\n둘째 줄')
  })
})

describe('createInquirySchema CRLF normalization', () => {
  it('should normalize CRLF in title and content before checking length', () => {
    // Arrange
    const crlfTitle = '제목 첫 줄\r\n제목 둘째 줄'
    const crlfContent = '문의 내용\r\n둘째 줄\r\n셋째 줄'

    // Act
    const parsed = createInquirySchema(CATEGORIES).safeParse({
      ...VALID_INPUT,
      title: crlfTitle,
      content: crlfContent,
    })

    // Assert — 저장되는 값은 LF 로 정규화돼 있다(관리자와 같은 규칙, CRLF 를 남기지 않는다).
    expect(parsed.success).toBe(true)
    expect(parsed.data?.title).toBe('제목 첫 줄\n제목 둘째 줄')
    expect(parsed.data?.content).toBe('문의 내용\n둘째 줄\n셋째 줄')
  })

  it('should count normalized length, not the raw CRLF length, against the max', () => {
    // Arrange — LF 기준(99자)으로는 상한(100자) 이내지만, CRLF 그대로 세면
    // 줄바꿈마다 1자씩 더 붙어(102자) 상한을 넘긴다.
    const line = '가'.repeat(24)
    const title = `${line}\r\n${line}\r\n${line}\r\n${line}`

    // Act
    const parsed = createInquirySchema(CATEGORIES).safeParse({ ...VALID_INPUT, title })

    // Assert
    expect(parsed.success).toBe(true)
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
    expect(result).toEqual({
      ok: false,
      message: `이미지·PDF는 최대 ${INQUIRY_FILE_MAX_COUNT}개까지 첨부할 수 있습니다.`,
    })
  })

  it('should reject unsupported types', () => {
    // Arrange & Act — 버킷은 이메일 첨부 때문에 zip 을 받지만 웹 폼은 받지 않는다.
    const result = validateInquiryAttachments([
      { name: 'a.zip', type: 'application/zip', size: 10 },
    ])

    // Assert
    expect(result.ok).toBe(false)
  })

  it('should accept webp because the bucket allows it', () => {
    // Arrange & Act — 캡처 도구·모바일이 만드는 형식이라 "이 사진만 안 되는" 일이 없게 한다.
    const result = validateInquiryAttachments([
      { name: 'shot.webp', type: 'image/webp', size: 2048 },
    ])

    // Assert
    expect(result.ok).toBe(true)
  })

  it('should reject empty files', () => {
    // Arrange & Act — 0바이트 오브젝트가 스토리지에 남으면 답변자가 열 수 없다.
    const result = validateInquiryAttachments([{ ...png, size: 0 }])

    // Assert
    expect(result.ok).toBe(false)
  })

  it('should reject a file over the per-file limit and name it', () => {
    // Arrange & Act
    const result = validateInquiryAttachments([
      { ...png, name: 'photo.jpg', type: 'image/jpeg', size: INQUIRY_ATTACHMENT_MAX_BYTES + 1 },
    ])

    // Assert — 어느 파일이 문제인지 알려 줘야 사용자가 다시 고를 수 있다.
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.message).toContain('photo.jpg')
    expect(result.ok === false && result.message).toContain(`${INQUIRY_ATTACHMENT_MAX_MB}MB`)
  })

  it('should reject a selection whose total exceeds the server action body limit', () => {
    // Arrange — 개별 파일은 상한 이내지만 합치면 본문 상한을 넘긴다. 여기서 막지 않으면
    // 요청이 액션에 닿기도 전에 끊겨 사용자는 필드 오류 대신 오류 화면을 본다.
    const big = { ...png, type: 'image/jpeg', size: INQUIRY_ATTACHMENT_MAX_BYTES }

    // Act
    const result = validateInquiryAttachments([big, big, big])

    // Assert
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.message).toContain(`${INQUIRY_ATTACHMENT_TOTAL_MAX_MB}MB`)
  })

  it('should keep every per-file limit inside the server action body limit', () => {
    // Arrange & Act — 규칙이 서로 어긋나면 "검증은 통과하는데 요청이 끊기는" 조합이 생긴다.
    const budget = INQUIRY_ATTACHMENT_TOTAL_MAX_BYTES

    // Assert
    expect(INQUIRY_ATTACHMENT_MAX_BYTES).toBeLessThanOrEqual(budget)
    expect(budget).toBeLessThan(bodyLimitBytes())
  })
})

describe('INQUIRY_ATTACHMENT_ACCEPT', () => {
  it('should list MIME types as well as extensions', () => {
    // Arrange & Act — 확장자만 주면 일부 모바일 브라우저가 사진 선택을 잠근다.
    const accept = INQUIRY_ATTACHMENT_ACCEPT.split(',')

    // Assert
    expect(accept).toContain('image/jpeg')
    expect(accept).toContain('image/webp')
    expect(accept).toContain('.jpg')
    expect(accept).toContain('.pdf')
  })
})

describe('updateInquirySchema', () => {
  it('should accept the same values as 접수 without asking for consent again', () => {
    // Arrange — 동의는 접수 시점에 이미 받아 privacy_consent 로 저장돼 있다.
    const { consent: _consent, ...input } = VALID_INPUT

    // Act
    const parsed = updateInquirySchema(CATEGORIES).safeParse(input)

    // Assert
    expect(parsed.success).toBe(true)
    expect(parsed.data?.title).toBe(VALID_INPUT.title)
  })

  it('should keep every rule 접수 uses', () => {
    // Arrange & Act — 상한이 갈리면 "접수는 됐는데 수정은 막히는" 문의가 생긴다.
    const shortTitle = updateInquirySchema(CATEGORIES).safeParse({ ...VALID_INPUT, title: '가' })
    const unknownCategory = updateInquirySchema(CATEGORIES).safeParse({
      ...VALID_INPUT,
      category: '없는분류',
    })

    // Assert
    expect(shortTitle.success).toBe(false)
    expect(unknownCategory.success).toBe(false)
  })

  it('should allow the type the inquiry was filed with', () => {
    // Arrange — 접수 당시의 '문의'(옛 3종). 지금은 어느 카테고리에도 없는 값이다.
    const { consent: _consent, ...input } = VALID_INPUT

    // Act
    const parsed = updateInquirySchema(CATEGORIES, ['문의']).safeParse({ ...input, type: '문의' })

    // Assert — 목록에 없다고 막으면 제목만 고치려던 사용자가 유형부터 다시 정해야 한다.
    expect(parsed.success).toBe(true)
    expect(parsed.data?.type).toBe('문의')
  })

  it("should not allow another inquiry's legacy type", () => {
    // Arrange & Act — 예외는 **이 문의가 들고 있던 값** 하나뿐이다.
    const { consent: _consent, ...input } = VALID_INPUT
    const parsed = updateInquirySchema(CATEGORIES, ['문의']).safeParse({ ...input, type: '신고' })

    // Assert
    expect(parsed.success).toBe(false)
  })

  it('should ignore a consent field sent by a direct POST', () => {
    // Arrange & Act — 수정 폼에는 동의 체크박스가 없다. 실려 와도 저장에 쓰지 않는다.
    const parsed = updateInquirySchema(CATEGORIES).safeParse({ ...VALID_INPUT, consent: false })

    // Assert
    expect(parsed.success).toBe(true)
    expect(parsed.data).not.toHaveProperty('consent')
  })
})

describe('isInquiryFormFilled', () => {
  /** 접수 폼이 실제로 싣는 이름 그대로 만든다. */
  function formOf(values: Record<string, string>, consent = true): FormData {
    const formData = new FormData()

    for (const [name, value] of Object.entries(values)) {
      formData.append(name, value)
    }

    if (consent) {
      formData.append('consent', 'on')
    }

    return formData
  }

  const FILLED = {
    accountId: '20123456789000000',
    category: '접속·서버',
    type: '로그인/접속 불가',
    title: '로그인이 되지 않습니다',
    content: '어제부터 로그인 화면에서 멈춥니다.',
  }

  it('should open the submit when every required field is filled', () => {
    // Arrange & Act & Assert
    expect(isInquiryFormFilled(formOf(FILLED), true)).toBe(true)
  })

  it('should stay closed while a required field is empty or blank', () => {
    // Arrange & Act & Assert — 공백만 친 칸은 채운 것으로 보지 않는다.
    expect(isInquiryFormFilled(formOf({ ...FILLED, type: '' }), true)).toBe(false)
    expect(isInquiryFormFilled(formOf({ ...FILLED, accountId: '   ' }), true)).toBe(false)
    expect(isInquiryFormFilled(formOf({ ...FILLED, title: '' }), true)).toBe(false)
  })

  it('should require the consent only when the form asks for it', () => {
    // Arrange & Act & Assert — 수정 화면에는 동의 체크박스가 없다.
    expect(isInquiryFormFilled(formOf(FILLED, false), true)).toBe(false)
    expect(isInquiryFormFilled(formOf(FILLED, false), false)).toBe(true)
  })

  it('should treat attachments as optional', () => {
    // Arrange & Act & Assert — 첨부는 선택 항목이다(2026-09-11 제품 결정).
    expect(isInquiryFormFilled(formOf(FILLED), true)).toBe(true)
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
    // Arrange & Act — DB CHECK(inquiries_attachments_file_kind_max_3)와 같은 한도를 앞단에서 잰다.
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

/**
 * 이미지·PDF 개수(3)와 영상 개수(2)는 각자 자리를 쓴다(2026-09-11 오너 지시).
 * 둘을 합친 전체 상한(5)도 DB CHECK 셋(`inquiries_attachments_max_5` ·
 * `inquiries_attachments_file_kind_max_3` · `inquiries_attachments_video_kind_max_2`)과
 * 같은 숫자여야 한다.
 */
describe('validateInquiryAttachments count matrix', () => {
  const file = { name: 'shot.png', type: 'image/png', size: 1024 }

  it('should accept three images alone', () => {
    // Arrange & Act & Assert
    expect(validateInquiryAttachments([file, file, file]).ok).toBe(true)
  })

  it('should reject a fourth image', () => {
    // Arrange & Act & Assert
    expect(validateInquiryAttachments([file, file, file, file]).ok).toBe(false)
  })

  it('should accept three images together with two already-attached videos', () => {
    // Arrange & Act — 이미지 3개(새로 고름) + 영상 2개(기존 첨부 또는 업로드 완료).
    const result = validateInquiryAttachments([file, file, file], 0, 2)

    // Assert — 3 + 2 = 5, 전체 상한과 같다.
    expect(result.ok).toBe(true)
  })

  it('should reject a selection whose combined count exceeds the overall total', () => {
    // Arrange & Act — 이미지 3개(파일 상한 이내) + 영상 3개(전체 상한을 넘긴다).
    const result = validateInquiryAttachments([file, file, file], 0, 3)

    // Assert — 종류별 상한과 별개로 합계 상한(5)도 지킨다.
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.message).toContain(`${INQUIRY_ATTACHMENT_MAX_TOTAL}`)
  })
})
