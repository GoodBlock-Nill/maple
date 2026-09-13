import { describe, expect, it } from 'vitest'

import {
  OPERATING_POLICY_ADDENDUM,
  OPERATING_POLICY_EFFECTIVE_DATE,
  OPERATING_POLICY_SECTIONS,
  OPERATING_POLICY_TITLE,
  OPERATING_POLICY_VERSION,
} from '@/lib/content/operating-policy'
import { POLICY_FALLBACKS } from '@/lib/content/policy-fallback'

import type { PolicyBlock, PolicySubsection } from '@/lib/content/operating-policy/types'

/**
 * 원문은 `docs/26년9월18일_글자월드_운영정책_1차(수정본).md` 하나다. 여기서 못 박는
 * 것은 그 파일과 코드 문안이 같은 문서라는 사실 — 장 수·절 제목·제재 표의 숫자다.
 * 법률 문서라 "대충 비슷하다"가 성립하지 않는다.
 */

function blockTexts(block: PolicyBlock): string[] {
  if (block.kind === 'list') {
    return [block.intro ?? '', ...block.items]
  }

  if (block.kind === 'table') {
    return [block.caption ?? '', ...block.headers, ...block.rows.flat()]
  }

  return [block.text]
}

function subsectionTexts(subsection: PolicySubsection): string[] {
  return [
    subsection.title,
    ...subsection.blocks.flatMap(blockTexts),
    ...(subsection.subsections ?? []).flatMap(subsectionTexts),
  ]
}

/** 문서 전체를 한 문자열로 눌러 담는다 — 어느 블록에 있든 "그 말이 있는가"만 본다. */
const FULL_TEXT = [
  ...OPERATING_POLICY_SECTIONS.flatMap((section) => [
    `${section.number}. ${section.title}`,
    ...section.blocks.flatMap(blockTexts),
    ...(section.subsections ?? []).flatMap(subsectionTexts),
  ]),
  ...OPERATING_POLICY_ADDENDUM.items,
].join('\n')

function flattenSubsections(parent: {
  subsections?: readonly PolicySubsection[]
}): PolicySubsection[] {
  return (parent.subsections ?? []).flatMap((subsection) => [
    subsection,
    ...flattenSubsections(subsection),
  ])
}

/** 절(`3-1`)·항(`가.`) 을 통째로 모아 둔다. id 중복을 보는 단언이 이 배열을 쓴다. */
const ALL_SUBSECTIONS = OPERATING_POLICY_SECTIONS.flatMap(flattenSubsections)

describe('운영정책 문서 뼈대', () => {
  it('should number every chapter once, in order', () => {
    // Arrange & Act
    const numbers = OPERATING_POLICY_SECTIONS.map((section) => section.number)

    // Assert — 아동·청소년 보호정책(옛 8장) 삭제로 목차가 1 ~ 9 장이 됐다.
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(new Set(OPERATING_POLICY_SECTIONS.map((section) => section.id)).size).toBe(
      numbers.length,
    )
  })

  it('should keep the nine chapter titles of the source document', () => {
    // Assert
    expect(OPERATING_POLICY_SECTIONS.map((section) => section.title)).toEqual([
      '기본 원칙',
      '이용자 권리 및 의무',
      '금지행위 및 제재 기준',
      '추가 제재 규정',
      '홈페이지(게시판) 운영정책',
      '복구 정책',
      '환불 정책',
      '고객센터 담당자 보호',
      '이의신청',
    ])
  })

  it('should split chapter 3 into its ten subsections', () => {
    // Arrange & Act — 3-1 ~ 3-10. `가/나/다` 항은 한 단계 더 아래라 여기서 세지 않는다.
    const chapter3 = OPERATING_POLICY_SECTIONS[2]

    // Assert
    expect(chapter3?.subsections?.map((subsection) => subsection.title)).toEqual([
      '3-1. 게임 내 질서 위반',
      '3-2. 거래 관련 위반',
      '3-3. 채팅 및 이름 위반',
      '3-4. 비인가 프로그램',
      '3-5. 게임 오류 유포',
      '3-6. 게임 오류 사용',
      '3-7. 개인정보 도용 및 유출',
      '3-8. 사행성 행위',
      '3-9. 타인 게임 이용 방해',
      '3-10. 홍보·광고',
    ])
  })

  it('should give every subsection a unique id', () => {
    // Assert — 목차·앵커가 id 로 만들어지므로 중복은 곧 죽은 링크다.
    const ids = ALL_SUBSECTIONS.map((subsection) => subsection.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('should carry the addendum outside the numbered chapters', () => {
    // Assert
    expect(OPERATING_POLICY_ADDENDUM.title).toBe('부칙')
    expect(OPERATING_POLICY_ADDENDUM.items).toHaveLength(3)
    expect(OPERATING_POLICY_ADDENDUM.items[0]).toContain('2026년 9월 18일 오픈 시점부터')
  })
})

describe('운영정책 1차 수정본(20260918-3)', () => {
  it('should publish as the third revision effective on the open day', () => {
    // Assert
    expect(OPERATING_POLICY_VERSION).toBe('20260918-3')
    expect(OPERATING_POLICY_EFFECTIVE_DATE).toBe('2026년 9월 18일')
    expect(OPERATING_POLICY_TITLE).toBe('글자월드 운영정책')
  })

  /* -3 개정으로 첫머리 넥슨·Toben 지식재산권 고지 인용 블록이 본문에서 빠졌다
     (사이트 푸터로 이동). 운영정책은 더 이상 `notice` 를 export 하지 않는다 —
     `OPERATING_POLICY_NOTICE` 를 여기서 import 하면 그 자체로 타입 에러가 난다. */
  it('should no longer attach an in-body ip notice to the fallback', () => {
    // Assert
    expect(POLICY_FALLBACKS.operating.notice).toBeUndefined()
  })

  /* 아동·청소년 보호정책(옛 8장, [8-1-1]~[8-2-3])이 새 수정본에서 전부 빠졌다. */
  it('should drop the child protection chapter entirely', () => {
    // Assert
    expect(FULL_TEXT).not.toContain('아동·청소년 보호정책')
    expect(FULL_TEXT).not.toContain('[8-1-1]')
    expect(FULL_TEXT).not.toContain('[8-2-3]')
    expect(FULL_TEXT).not.toContain('아동·청소년의 개인정보를 도용하거나 유포')
  })

  /* 초안이 쓰던 "글자서버"는 운영자 확정으로 "글자월드" 하나가 됐다. 새 수정본이
     [1-1]·2-1 에서 다시 "글자서버"로 되돌아간 오기를 보였지만, 코드는 그 회귀를
     따르지 않는다 — 문안 대조 시 이 두 곳만은 md 와 의도적으로 다르다. */
  it('should never say 글자서버', () => {
    // Assert
    expect(FULL_TEXT).not.toContain('글자서버')
    expect(FULL_TEXT).toContain('글자월드 운영팀(이하 "운영팀")')
    expect(FULL_TEXT).toContain('글자월드의 모든 콘텐츠를 이용약관 범위 내에서 이용할 권리')
  })

  it('should fix the 900일 typo in the trade sanction table', () => {
    // Arrange & Act — 3-2 가. 부당이득을 회수할 수 있는 사기 거래.
    const trade = OPERATING_POLICY_SECTIONS[2]?.subsections?.[1]?.subsections?.[0]
    const table = trade?.blocks.find((block) => block.kind === 'table')

    // Assert
    expect(table?.rows).toEqual([
      ['제재', '30일 이용제한', '90일 이용제한', '180일 이용제한', '영구 이용제한'],
    ])
    expect(FULL_TEXT).not.toContain('900일')
  })

  it('should drop the 수사 의뢰 검토 wording from the privacy leak sanction', () => {
    // Arrange & Act — 3-7 다. 개인정보 직접 유출.
    const leak = OPERATING_POLICY_SECTIONS[2]?.subsections?.[6]?.subsections?.[2]
    const table = leak?.blocks.find((block) => block.kind === 'table')

    // Assert
    expect(table?.rows).toEqual([['1차 (즉시 영구)', '영구 이용제한']])
    expect(FULL_TEXT).not.toContain('수사 의뢰 검토')
  })
})

describe('운영정책 본문의 핵심 규정', () => {
  it('should grant the fifteen day appeal window in both places it appears', () => {
    // Assert — 2-1(권리)과 9-1(절차, 옛 10-1)이 같은 기한을 말해야 한다.
    expect(FULL_TEXT).toContain('게임 이용 제한에 대해 **제재일로부터 15일 이내** 이의신청할 권리')
    expect(FULL_TEXT).toContain(
      '게임 이용 제한에 이의가 있는 경우, **제재일로부터 15일 이내**에 고객센터를 통해 이의신청을 할 수 있습니다.',
    )
  })

  it('should ban unauthorised programs permanently on the first offence', () => {
    // Assert — 3-4.
    expect(FULL_TEXT).toContain('**1차 (즉시 영구)**')
    expect(FULL_TEXT).toContain('**영구 이용제한**')
  })

  it('should keep the seven day cash item withdrawal window', () => {
    // Assert — 7-1.
    expect(FULL_TEXT).toContain('구매 후 **7일 이내**에 고객센터를 통해 환불 신청')
  })

  it('should list the three appeals that are never accepted', () => {
    // Assert — 9-4 (옛 10-4).
    expect(FULL_TEXT).toContain('**비인가 프로그램** 사용으로 인한 영구 이용제한')
    expect(FULL_TEXT).toContain('타인의 개인정보 직접 유포로 인한 영구 이용제한')
    expect(FULL_TEXT).toContain('계정 도용으로 인한 영구 이용제한')
  })

  it('should keep the two board sanction rows of chapter 5', () => {
    // Arrange & Act
    const table = OPERATING_POLICY_SECTIONS[4]?.blocks.find((block) => block.kind === 'table')

    // Assert
    expect(table?.headers).toEqual(['위반 유형', '1차', '2차', '3차', '4차 이상'])
    expect(table?.rows).toHaveLength(2)
    expect(table?.rows[0]?.at(-1)).toBe('영구 홈페이지 + 30일 게임 제한')
  })

  it('should renumber customer service protection to chapter 8', () => {
    // Assert — 옛 9장이 8장으로, 조항 없는 목록·표만 있는 절 구성은 그대로.
    const chapter8 = OPERATING_POLICY_SECTIONS[7]

    expect(chapter8?.title).toBe('고객센터 담당자 보호')
    expect(chapter8?.subsections?.map((subsection) => subsection.title)).toEqual([
      '8-1. 금지 행위',
      '8-2. 제재 기준',
    ])
  })

  it('should renumber the appeal chapter codes from 10-x to 9-x', () => {
    // Assert — 옛 10장의 [10-1]~[10-5] 가 [9-1]~[9-5] 로 바뀐다.
    const chapter9 = OPERATING_POLICY_SECTIONS[8]
    const codes = chapter9?.blocks
      .map((block) => (block.kind === 'paragraph' ? block.code : undefined))
      .filter((code): code is string => code !== undefined)

    expect(chapter9?.title).toBe('이의신청')
    expect(codes).toEqual(['[9-1]', '[9-2]', '[9-3]'])
    expect(FULL_TEXT).toContain('[9-4] 이의신청이 접수되지 않는 경우')
    expect(FULL_TEXT).toContain('[9-5] 이의신청 시 필요 정보')
    expect(FULL_TEXT).not.toContain('[10-')
  })
})

describe('폴백 등록', () => {
  it('should hand the whole document to the operating fallback', () => {
    // Assert
    expect(POLICY_FALLBACKS.operating.version).toBe(OPERATING_POLICY_VERSION)
    expect(POLICY_FALLBACKS.operating.sections).toBe(OPERATING_POLICY_SECTIONS)
    expect(POLICY_FALLBACKS.operating.addendum).toBe(OPERATING_POLICY_ADDENDUM)
  })

  /* 넥슨 IP 고지는 이제 사이트 전역 문구(`site_settings.ip_notice`) 하나뿐이다.
     운영정책은 본문에도, 말미 첨부로도 IP 고지를 더 이상 싣지 않는다. */
  it('should not also append the site-wide ip notice', () => {
    // Assert
    expect(POLICY_FALLBACKS.operating.hasIpNotice).toBe(false)
    expect(POLICY_FALLBACKS.privacy.hasIpNotice).toBe(true)
  })
})
