import { describe, expect, it } from 'vitest'

import {
  DISCORD_POLICY_EFFECTIVE_DATE,
  DISCORD_POLICY_NOTICE,
  DISCORD_POLICY_SECTIONS,
  DISCORD_POLICY_TITLE,
  DISCORD_POLICY_VERSION,
} from '@/lib/content/discord-policy'
import { POLICY_FALLBACKS } from '@/lib/content/policy-fallback'
import { policySectionsToHtml } from '@/lib/content/policy-to-html'

import type { PolicyParagraphBlock } from '@/lib/content/operating-policy/types'

/**
 * 디스코드 운영정책 — 운영자 확정 문안(2026-09-11) 구조화 데이터 검증.
 *
 * 옛 "정식 운영정책 문안은 준비 중입니다" 안내 문단을 대체한 첫 발행본이라, 조항
 * 수·순서·문안 그리고 발행 메타데이터를 다른 정책 테스트와 같은 방식으로 못 박는다.
 */

/** 조항 하나의 텍스트를 순서대로 뽑는다. 문단이 아니면 곧바로 실패시킨다. */
function paragraphTexts(section: (typeof DISCORD_POLICY_SECTIONS)[number]): string[] {
  return section.blocks.map((block) => {
    if (block.kind !== 'paragraph') {
      throw new Error(`문단이 아닌 블록이 섞여 있습니다: ${section.id}`)
    }

    return (block as PolicyParagraphBlock).text
  })
}

describe('DISCORD_POLICY_SECTIONS', () => {
  it('should carry the four chapters in order', () => {
    const titles = DISCORD_POLICY_SECTIONS.map((section) => section.title)

    expect(titles).toEqual(['기본 원칙', '금지행위', '제재', '기타'])
  })

  it('should number sections sequentially starting at 1', () => {
    const numbers = DISCORD_POLICY_SECTIONS.map((section) => section.number)

    expect(numbers).toEqual([1, 2, 3, 4])
  })

  it('should give every section a non-empty id and title', () => {
    for (const section of DISCORD_POLICY_SECTIONS) {
      expect(section.id.trim()).not.toBe('')
      expect(section.title.trim()).not.toBe('')
    }
  })

  it('should carry the ten prohibited-act rules verbatim in order with [2-n] codes', () => {
    const forbidden = DISCORD_POLICY_SECTIONS.find((section) => section.id === 'section-2')

    if (forbidden === undefined) {
      throw new Error('section-2 가 없습니다.')
    }

    const codes = forbidden.blocks.map((block) =>
      block.kind === 'paragraph' ? block.code : undefined,
    )

    expect(codes).toEqual([
      '[2-1]',
      '[2-2]',
      '[2-3]',
      '[2-4]',
      '[2-5]',
      '[2-6]',
      '[2-7]',
      '[2-8]',
      '[2-9]',
      '[2-10]',
    ])

    expect(paragraphTexts(forbidden)).toEqual([
      '욕설, 비속어, 혐오 발언, 차별적 표현 사용을 금지합니다.',
      '특정 유저를 비방, 모욕, 괴롭히는 행위를 금지합니다.',
      '도배 행위를 금지합니다. 동일하거나 유사한 메시지·이모지의 반복 전송을 포함합니다.',
      '타 서버, 외부 커뮤니티, SNS, 상업적 광고 링크 무단 공유를 금지합니다.',
      '타인의 개인정보 유출 또는 공유를 금지합니다.',
      '저작권이 있는 콘텐츠 무단 게시를 금지합니다.',
      '허위 정보 유포, 운영진 또는 타인 사칭 행위를 금지합니다.',
      '게임 내 버그, 취약점, 핵·매크로 등 불법 프로그램 정보 공유를 금지합니다.',
      '커뮤니티 기준에 부합하지 않는 닉네임, 프로필 사진 사용을 금지합니다.',
      '미성년자를 포함한 모든 유저에 대한 성적·불건전한 표현 및 행위를 금지합니다.',
    ])
  })

  it('should carry the sanction paragraph verbatim', () => {
    const sanction = DISCORD_POLICY_SECTIONS.find((section) => section.id === 'section-3')

    if (sanction === undefined) {
      throw new Error('section-3 가 없습니다.')
    }

    expect(paragraphTexts(sanction)).toEqual([
      '위 항목에 해당하는 댓글, 이미지 등의 불건전한 정도에 따라 구체적으로 해당되지 않는 사항이라도 기타 사회 통념상 수용하기 어려운 글 등록, 업로드 하거나 서버 운영에 지장을 초래할 경우 별도의 경고 없이 서버에서 추방 또는 영구 차단될 수 있습니다.',
    ])
  })

  it('should carry the Discord community guidelines reference verbatim, including the URL', () => {
    const etc = DISCORD_POLICY_SECTIONS.find((section) => section.id === 'section-4')

    if (etc === undefined) {
      throw new Error('section-4 가 없습니다.')
    }

    const [text] = paragraphTexts(etc)

    expect(text).toBe(
      "이용규칙에 포함되지 않는 내용은 Discord에서 제공되는 'Discord 커뮤니티 가이드라인' (https://discord.com/guidelines) 을 따릅니다.",
    )
    expect(text).toContain('https://discord.com/guidelines')
  })

  it('should not leak the numeral emoji markers from the source Discord notice', () => {
    const allText = DISCORD_POLICY_SECTIONS.flatMap((section) =>
      section.blocks.flatMap((block) => (block.kind === 'paragraph' ? [block.text] : [])),
    ).join('\n')

    expect(allText).not.toMatch(/:one:|:two:|:keycap_ten:/u)
  })
})

describe('DISCORD_POLICY_NOTICE', () => {
  it('should carry the three welcome lines verbatim', () => {
    expect(DISCORD_POLICY_NOTICE.lines).toEqual([
      '글자월드 공식 디스코드에 오신 것을 환영합니다.',
      '본 서버는 글자월드 이용자들이 자유롭게 소통하고 정보를 나누는 공간입니다.',
      '모든 멤버는 아래 운영정책을 숙지하고 준수해 주시기 바랍니다.',
    ])
  })
})

describe('발행 메타데이터', () => {
  it('should publish the owner-confirmed text as 20260911-1', () => {
    expect(DISCORD_POLICY_TITLE).toBe('글자월드 디스코드 운영정책')
    expect(DISCORD_POLICY_VERSION).toBe('20260911-1')
    expect(DISCORD_POLICY_EFFECTIVE_DATE).toBe('2026년 9월 11일')
  })

  it('should hand the structured sections and notice to the discord fallback', () => {
    expect(POLICY_FALLBACKS.discord.sections).toBe(DISCORD_POLICY_SECTIONS)
    expect(POLICY_FALLBACKS.discord.notice).toBe(DISCORD_POLICY_NOTICE)
    expect(POLICY_FALLBACKS.discord.version).toBe(DISCORD_POLICY_VERSION)
    expect(POLICY_FALLBACKS.discord.effectiveDate).toBe(DISCORD_POLICY_EFFECTIVE_DATE)
    expect(POLICY_FALLBACKS.discord.title).toBe(DISCORD_POLICY_TITLE)
    // 구조화 문안이 생겼으니 더 이상 안내 문단(paragraphs) 경로를 쓰지 않는다.
    expect(POLICY_FALLBACKS.discord.paragraphs).toEqual([])
  })
})

describe('policySectionsToHtml({ sections: DISCORD_POLICY_SECTIONS })', () => {
  const html = policySectionsToHtml({
    sections: DISCORD_POLICY_SECTIONS,
    notice: DISCORD_POLICY_NOTICE,
  })

  it('should render an <h2> heading for each of the four chapters', () => {
    expect(html.match(/<h2>/gu)?.length).toBe(DISCORD_POLICY_SECTIONS.length)
    expect(html).toContain('<h2>1. 기본 원칙</h2>')
    expect(html).toContain('<h2>2. 금지행위</h2>')
    expect(html).toContain('<h2>3. 제재</h2>')
    expect(html).toContain('<h2>4. 기타</h2>')
  })

  it('should keep the Discord community guidelines URL as plain text', () => {
    expect(html).toContain('https://discord.com/guidelines')
  })

  it('should put the welcome notice in front as one paragraph with line breaks', () => {
    expect(html.startsWith('<p>글자월드 공식 디스코드에 오신 것을 환영합니다.<br />')).toBe(true)
  })
})
