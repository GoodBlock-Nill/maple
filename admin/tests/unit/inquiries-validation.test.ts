import { describe, expect, it } from 'vitest'

import {
  DEFAULT_INQUIRY_STATUS_TAB,
  INQUIRY_REPLY_MAX_LENGTH,
  canTransitionInquiryStatus,
  inquiryReplySchema,
  inquiryStatusSchema,
  isCancelledInquiry,
  isInquirySource,
  maskAccountId,
  parseInquiryFilters,
  sanitizeInquirySearch,
  statusesForTab,
  toInquirySource,
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
    expect(
      inquiryStatusSchema.safeParse({ inquiryId: INQUIRY_ID, status: 'deleted' }).success,
    ).toBe(false)
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

  /* 옵션 목록은 DB(`inquiry_categories`) + 데이터에 남은 옛 라벨이라 고정 배열로
     검사할 수 없다. 라벨일 수 없는 값(빈 값 · 상한 초과)만 걸러 낸다. */
  it('라벨 모양이면 그대로 두고, 라벨일 수 없는 값은 무시한다', () => {
    expect(parseInquiryFilters({ category: '접속·서버' }).category).toBe('접속·서버')
    expect(parseInquiryFilters({ category: '  결제  ' }).category).toBe('결제')
    expect(parseInquiryFilters({ category: '' }).category).toBeNull()
    expect(parseInquiryFilters({ category: '가'.repeat(21) }).category).toBeNull()
  })

  /* 유형 옵션도 DB(세부 문의 유형) + 데이터에 남은 옛 값이라 같은 규칙이다. */
  it('유형은 모양만 보고, 유형일 수 없는 값은 무시한다', () => {
    expect(parseInquiryFilters({ type: '로그인/접속 불가' }).type).toBe('로그인/접속 불가')
    expect(parseInquiryFilters({ type: '  문의  ' }).type).toBe('문의')
    expect(parseInquiryFilters({}).type).toBeNull()
    expect(parseInquiryFilters({ type: '' }).type).toBeNull()
    expect(parseInquiryFilters({ type: '가'.repeat(31) }).type).toBeNull()
  })

  it('출처는 web · email 만 받는다', () => {
    expect(parseInquiryFilters({ source: 'web' }).source).toBe('web')
    expect(parseInquiryFilters({ source: 'email' }).source).toBe('email')
  })

  it('출처가 없거나 모르는 값이면 전체(null)다', () => {
    expect(parseInquiryFilters({}).source).toBeNull()
    expect(parseInquiryFilters({ source: 'sms' }).source).toBeNull()
    expect(parseInquiryFilters({ source: '' }).source).toBeNull()
  })

  it('같은 키가 반복되면 첫 값만 쓴다', () => {
    expect(parseInquiryFilters({ source: ['email', 'web'] }).source).toBe('email')
  })

  it('날짜는 YYYY-MM-DD 만 받는다', () => {
    expect(parseInquiryFilters({ from: '2026-09-08' }).from).toBe('2026-09-08')
    expect(parseInquiryFilters({ from: '2026/09/08' }).from).toBeNull()
    expect(parseInquiryFilters({ to: '2026-13-40' }).to).toBeNull()
  })

  /* 회원 상세의 "전체 보기"(`/inquiries?user=<id>`)가 쓰는 필터다. `profiles.id`
     는 uuid 라 모양이 아닌 값은 걸지 않는다(= 전체) — 임의 문자열이 `eq()` 값으로
     그대로 흘러가지 않게 한다. */
  it('회원 필터는 uuid 모양일 때만 받는다', () => {
    const memberId = '11111111-2222-4333-8444-555555555555'

    expect(parseInquiryFilters({ user: memberId }).userId).toBe(memberId)
    expect(parseInquiryFilters({ user: memberId.toUpperCase() }).userId).toBe(
      memberId.toUpperCase(),
    )
    expect(parseInquiryFilters({}).userId).toBeNull()
    expect(parseInquiryFilters({ user: 'not-a-uuid' }).userId).toBeNull()
    expect(parseInquiryFilters({ user: ['a', memberId] }).userId).toBeNull()
  })
})

describe('statusesForTab', () => {
  it('전체 탭은 네 상태를 모두 담는다', () => {
    expect(statusesForTab('all')).toEqual(['pending', 'in_progress', 'answered', 'closed'])
  })
})

describe('isInquirySource', () => {
  it('알려진 출처만 통과시킨다', () => {
    expect(isInquirySource('web')).toBe(true)
    expect(isInquirySource('email')).toBe(true)
    expect(isInquirySource('EMAIL')).toBe(false)
    expect(isInquirySource(null)).toBe(false)
    expect(isInquirySource(undefined)).toBe(false)
  })
})

/* DB 열이 text 라 제약 밖의 값이 들어올 여지가 있다. 화면이 비는 것보다 '웹'으로
   보이는 편이 안전하다 — 운영자가 목록에서 그 문의를 놓치지 않는다. */
describe('toInquirySource', () => {
  it('모르는 값은 웹으로 떨어뜨린다', () => {
    expect(toInquirySource('email')).toBe('email')
    expect(toInquirySource('kakao')).toBe('web')
    expect(toInquirySource(null)).toBe('web')
  })
})
