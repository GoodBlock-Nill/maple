import { describe, expect, it } from 'vitest'

import {
  OPERATING_POLICY_ADDENDUM,
  OPERATING_POLICY_EFFECTIVE_DATE,
  OPERATING_POLICY_NOTICE,
  OPERATING_POLICY_SECTIONS,
  OPERATING_POLICY_TITLE,
  OPERATING_POLICY_VERSION,
} from '@/lib/content/operating-policy'
import { POLICY_FALLBACKS } from '@/lib/content/policy-fallback'

import type { PolicyBlock, PolicySubsection } from '@/lib/content/operating-policy/types'

/**
 * 원문은 `docs/26년9월18일_글자월드_운영정책_1차(수정).md` 하나다. 여기서 못 박는
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
  ...OPERATING_POLICY_NOTICE.lines,
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

    // Assert — 원문의 목차가 1 ~ 10 장이다.
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(new Set(OPERATING_POLICY_SECTIONS.map((section) => section.id)).size).toBe(
      numbers.length,
    )
  })

  it('should keep the ten chapter titles of the source document', () => {
    // Assert
    expect(OPERATING_POLICY_SECTIONS.map((section) => section.title)).toEqual([
      '기본 원칙',
      '이용자 권리 및 의무',
      '금지행위 및 제재 기준',
      '추가 제재 규정',
      '홈페이지(게시판) 운영정책',
      '복구 정책',
      '환불 정책',
      '아동·청소년 보호정책',
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

describe('운영정책 1차 수정본(20260918-2)', () => {
  it('should publish as the second revision effective on the open day', () => {
    // Assert
    expect(OPERATING_POLICY_VERSION).toBe('20260918-2')
    expect(OPERATING_POLICY_EFFECTIVE_DATE).toBe('2026년 9월 18일')
    expect(OPERATING_POLICY_TITLE).toBe('글자월드 운영정책')
  })

  it('should open with the nexon and toben ip notice', () => {
    // Assert — 원문 첫머리의 인용 네 줄.
    expect(OPERATING_POLICY_NOTICE.lines).toEqual([
      '본 서버는 넥슨(주)의 메이플스토리월드 플랫폼에서 공식 출시된 글자월드입니다.',
      "'MapleStory' 및 관련 지식재산권은 NEXON Korea Corp.에 있습니다.",
      "'MapleStory Worlds' 및 관련 지식재산권은 Toben Studio Inc.에 있습니다.",
      '본 서비스는 이용약관 및 가이드라인을 준수하여 운영됩니다.',
    ])
  })

  /* 초안이 쓰던 "글자서버"는 운영자 확정으로 "글자월드" 하나가 됐다. 원문 파일까지
     같이 고쳤으니 코드에 남아 있으면 그건 옮기다 만 것이다. */
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
    // Arrange & Act — 3-7 다. 개인정보 직접 유포.
    const leak = OPERATING_POLICY_SECTIONS[2]?.subsections?.[6]?.subsections?.[2]
    const table = leak?.blocks.find((block) => block.kind === 'table')

    // Assert
    expect(table?.rows).toEqual([['1차 (즉시 영구)', '영구 이용제한']])
    expect(FULL_TEXT).not.toContain('수사 의뢰 검토')
  })
})

describe('운영정책 본문의 핵심 규정', () => {
  it('should grant the fifteen day appeal window in both places it appears', () => {
    // Assert — 2-1(권리)과 10-1(절차)이 같은 기한을 말해야 한다.
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
    // Assert — 10-4.
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
})

describe('폴백 등록', () => {
  it('should hand the whole document to the operating fallback', () => {
    // Assert
    expect(POLICY_FALLBACKS.operating.version).toBe(OPERATING_POLICY_VERSION)
    expect(POLICY_FALLBACKS.operating.sections).toBe(OPERATING_POLICY_SECTIONS)
    expect(POLICY_FALLBACKS.operating.notice).toBe(OPERATING_POLICY_NOTICE)
    expect(POLICY_FALLBACKS.operating.addendum).toBe(OPERATING_POLICY_ADDENDUM)
  })

  /* 넥슨 IP 고지는 두 벌이 아니다. 운영정책은 본문 첫머리에 원문 그대로 싣고,
     `site_settings.ip_notice` 를 말미에 덧붙이는 문서(개인정보처리방침)와 다르다. */
  it('should not also append the site-wide ip notice', () => {
    // Assert
    expect(POLICY_FALLBACKS.operating.hasIpNotice).toBe(false)
    expect(POLICY_FALLBACKS.privacy.hasIpNotice).toBe(true)
  })
})
