import { describe, expect, it } from 'vitest'

import {
  DEFAULT_INQUIRY_STATUS_TAB,
  INQUIRY_REPLY_MAX_LENGTH,
  canTransitionInquiryStatus,
  inquiryReplySchema,
  inquiryStatusSchema,
  isCancelledInquiry,
  maskAccountId,
  parseInquiryFilters,
  sanitizeInquirySearch,
  statusesForTab,
} from '@/lib/validation/inquiries'

const INQUIRY_ID = '11111111-2222-4333-8444-555555555555'

describe('canTransitionInquiryStatus', () => {
  it('접수 대기에서는 처리 중 · 답변 완료 · 종료로 갈 수 있다', () => {
    expect(canTransitionInquiryStatus('pending', 'in_progress')).toBe(true)
    expect(canTransitionInquiryStatus('pending', 'answered')).toBe(true)
    expect(canTransitionInquiryStatus('pending', 'closed')).toBe(true)
  })

  it('답변 완료에서는 종료만 허용한다', () => {
    expect(canTransitionInquiryStatus('answered', 'closed')).toBe(true)
    expect(canTransitionInquiryStatus('answered', 'pending')).toBe(false)
    expect(canTransitionInquiryStatus('answered', 'in_progress')).toBe(false)
  })

  it('종료된 문의는 처리 중으로만 되살릴 수 있다', () => {
    expect(canTransitionInquiryStatus('closed', 'in_progress')).toBe(true)
    expect(canTransitionInquiryStatus('closed', 'answered')).toBe(false)
    expect(canTransitionInquiryStatus('closed', 'pending')).toBe(false)
  })

  it('처리 중은 접수 대기로 되돌아가지 않는다', () => {
    expect(canTransitionInquiryStatus('in_progress', 'answered')).toBe(true)
    expect(canTransitionInquiryStatus('in_progress', 'closed')).toBe(true)
    expect(canTransitionInquiryStatus('in_progress', 'pending')).toBe(false)
  })

  it('같은 상태로의 전이는 전이로 보지 않는다', () => {
    expect(canTransitionInquiryStatus('pending', 'pending')).toBe(false)
    expect(canTransitionInquiryStatus('closed', 'closed')).toBe(false)
  })
})

describe('isCancelledInquiry', () => {
  it('사용자 사이트와 같이 취소 시각만으로 판정한다', () => {
    expect(isCancelledInquiry('2026-09-08T00:00:00Z')).toBe(true)
    expect(isCancelledInquiry(null)).toBe(false)
    expect(isCancelledInquiry(undefined)).toBe(false)
    expect(isCancelledInquiry('')).toBe(false)
  })
})

describe('inquiryReplySchema', () => {
  const base = {
    inquiryId: INQUIRY_ID,
    nextStatus: 'answered' as const,
    useOperatorName: true,
  }

  it('앞뒤 공백을 다듬고 통과시킨다', () => {
    const parsed = inquiryReplySchema.parse({ ...base, content: '  확인했습니다.  ' })

    expect(parsed.content).toBe('확인했습니다.')
  })

  it('브라우저가 붙이는 CRLF 를 LF 로 되돌린다', () => {
    /* textarea 는 폼 전송 시 줄바꿈을 CRLF 로 정규화한다(HTML 사양).
       저장 값에 \r 이 남으면 사용자 화면·검색·글자 수가 흔들린다. */
    const parsed = inquiryReplySchema.parse({ ...base, content: '첫 줄\r\n둘째 줄' })

    expect(parsed.content).toBe('첫 줄\n둘째 줄')
  })

  it('빈 답변을 거부한다', () => {
    const result = inquiryReplySchema.safeParse({ ...base, content: '   ' })

    expect(result.success).toBe(false)
  })

  it(`${INQUIRY_REPLY_MAX_LENGTH}자까지 허용하고 그 이상은 거부한다`, () => {
    const limit = 'ㄱ'.repeat(INQUIRY_REPLY_MAX_LENGTH)

    expect(inquiryReplySchema.safeParse({ ...base, content: limit }).success).toBe(true)
    expect(inquiryReplySchema.safeParse({ ...base, content: `${limit}ㄴ` }).success).toBe(false)
  })

  it('답변 후 상태는 답변 완료 · 처리 중만 받는다', () => {
    expect(
      inquiryReplySchema.safeParse({ ...base, content: '답변', nextStatus: 'closed' }).success,
    ).toBe(false)
    expect(
      inquiryReplySchema.safeParse({ ...base, content: '답변', nextStatus: 'in_progress' }).success,
    ).toBe(true)
  })

  it('문의 id 가 uuid 가 아니면 거부한다', () => {
    const result = inquiryReplySchema.safeParse({ ...base, inquiryId: 'not-a-uuid', content: 'x' })

    expect(result.success).toBe(false)
  })
})

describe('inquiryStatusSchema', () => {
  it('enum 밖의 상태를 거부한다', () => {
    expect(inquiryStatusSchema.safeParse({ inquiryId: INQUIRY_ID, status: 'deleted' }).success).toBe(
      false,
    )
    expect(inquiryStatusSchema.safeParse({ inquiryId: INQUIRY_ID, status: 'closed' }).success).toBe(
      true,
    )
  })
})

describe('maskAccountId', () => {
  it('사용자 사이트와 같은 규칙으로 가린다(1234****000)', () => {
    expect(maskAccountId('123456789012345')).toBe('1234****345')
    expect(maskAccountId('123456789000000')).toBe('1234****000')
  })

  it('짧은 값은 앞 한 글자만 남긴다', () => {
    expect(maskAccountId('1234567')).toBe('1****')
    expect(maskAccountId('1')).toBe('1****')
  })

  it('마스크 길이가 원문 길이를 드러내지 않는다', () => {
    expect(maskAccountId('12345678901234567890')).toBe('1234****890')
  })

  it('비어 있으면 하이픈을 돌려준다', () => {
    expect(maskAccountId(null)).toBe('-')
    expect(maskAccountId(undefined)).toBe('-')
    expect(maskAccountId('   ')).toBe('-')
  })

  it('마스킹 결과에 원문 중간값이 남지 않는다', () => {
    expect(maskAccountId('abcdefghij')).not.toContain('defgh')
  })
})

describe('sanitizeInquirySearch', () => {
  it('or() 문법과 LIKE 와일드카드를 걷어낸다', () => {
    expect(sanitizeInquirySearch('a,b(c)%d_e')).toBe('a b c d e')
  })

  it('빈 값은 null 이다', () => {
    expect(sanitizeInquirySearch('   ')).toBeNull()
    expect(sanitizeInquirySearch(undefined)).toBeNull()
  })

  it('길이를 잘라 낸다', () => {
    expect(sanitizeInquirySearch('가'.repeat(200))?.length).toBe(60)
  })
})

describe('parseInquiryFilters', () => {
  it('상태가 없으면 미처리 탭이다', () => {
    const filters = parseInquiryFilters({})

    expect(filters.tab).toBe(DEFAULT_INQUIRY_STATUS_TAB)
    expect(filters.statuses).toEqual(['pending', 'in_progress'])
    expect(filters.cancelledOnly).toBe(false)
  })

  it('모르는 상태 값은 기본 탭으로 떨어진다', () => {
    expect(parseInquiryFilters({ status: 'nope' }).tab).toBe(DEFAULT_INQUIRY_STATUS_TAB)
  })

  it('접수 취소 탭은 상태를 좁히지 않고 취소 조건만 건다', () => {
    const filters = parseInquiryFilters({ status: 'cancelled' })

    expect(filters.statuses).toEqual(['pending', 'in_progress', 'answered', 'closed'])
    expect(filters.cancelledOnly).toBe(true)
  })

  it('목록에 없는 카테고리는 무시한다', () => {
    expect(parseInquiryFilters({ category: '결제' }).category).toBe('결제')
    expect(parseInquiryFilters({ category: 'DROP TABLE' }).category).toBeNull()
  })

  it('날짜는 YYYY-MM-DD 만 받는다', () => {
    expect(parseInquiryFilters({ from: '2026-09-08' }).from).toBe('2026-09-08')
    expect(parseInquiryFilters({ from: '2026/09/08' }).from).toBeNull()
    expect(parseInquiryFilters({ to: '2026-13-40' }).to).toBeNull()
  })
})

describe('statusesForTab', () => {
  it('전체 탭은 네 상태를 모두 담는다', () => {
    expect(statusesForTab('all')).toEqual(['pending', 'in_progress', 'answered', 'closed'])
  })
})
