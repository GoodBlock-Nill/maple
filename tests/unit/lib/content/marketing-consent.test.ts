import { describe, expect, it } from 'vitest'

import {
  MARKETING_CONSENT_EFFECTIVE_DATE,
  MARKETING_CONSENT_HEADING,
  MARKETING_CONSENT_SECTIONS,
  MARKETING_CONSENT_TITLE,
  MARKETING_CONSENT_VERSION,
} from '@/lib/content/marketing-consent'
import { marketingConsentFallbackHtml } from '@/lib/content/marketing-consent-html'
import { POLICY_FALLBACKS } from '@/lib/content/policy-fallback'

/** 문서 전체를 한 문자열로 눌러 담는다 — 어느 블록에 있든 "그 말이 있는가"만 본다. */
const FULL_TEXT = MARKETING_CONSENT_SECTIONS.flatMap((section) =>
  section.blocks.flatMap((block) => {
    if (block.kind === 'list') {
      return [block.intro ?? '', ...block.items]
    }

    if (block.kind === 'table') {
      return [block.caption ?? '', ...block.headers, ...block.rows.flat()]
    }

    return [block.text]
  }),
).join('\n')

describe('마케팅 정보 수신 동의 문안', () => {
  it('should number every section once, in order', () => {
    // Arrange & Act
    const numbers = MARKETING_CONSENT_SECTIONS.map((section) => section.number)

    // Assert
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(new Set(MARKETING_CONSENT_SECTIONS.map((section) => section.id)).size).toBe(
      numbers.length,
    )
  })

  it('should cite the laws the consent rests on', () => {
    // Assert — 정보통신망법 제50조·시행령 제61조·제62조, 개인정보 보호법 제15조·제22조.
    expect(FULL_TEXT).toContain('정보통신망 이용촉진 및 정보보호 등에 관한 법률」 제50조')
    expect(FULL_TEXT).toContain('시행령 제61조')
    expect(FULL_TEXT).toContain('제62조')
    expect(FULL_TEXT).toContain('개인정보 보호법」 제15조')
    expect(FULL_TEXT).toContain('제22조')
  })

  it('should explain the night-time sending ban', () => {
    // Assert — 오후 9시 ~ 다음 날 오전 8시(제50조 제3항).
    expect(MARKETING_CONSENT_SECTIONS.some((section) => section.title === '야간 전송 제한')).toBe(
      true,
    )
    expect(FULL_TEXT).toContain('오후 9시부터 다음 날 오전 8시')
    expect(FULL_TEXT).toContain('제50조 제3항')
  })

  it('should promise the two-year re-confirmation', () => {
    // Assert — 시행령 제62조의3.
    expect(FULL_TEXT).toContain('2년마다')
    expect(FULL_TEXT).toContain('제62조의3')
  })

  it('should tell how to withdraw the consent', () => {
    // Assert
    expect(MARKETING_CONSENT_SECTIONS.some((section) => section.title === '동의 철회 방법')).toBe(
      true,
    )
    expect(FULL_TEXT).toContain('마이페이지 > 계정 관리 > 마케팅 수신 설정')
    expect(FULL_TEXT).toContain('care@gjstory.com')
  })

  it('should say what is collected and that phone numbers are not', () => {
    // Assert
    expect(FULL_TEXT).toContain('이메일 주소')
    expect(FULL_TEXT).toContain('닉네임')
    expect(FULL_TEXT).toContain('휴대전화번호는 지금 수집하지 않습니다')
  })

  it('should say the consent is optional with no penalty', () => {
    // Assert
    expect(FULL_TEXT).toContain('거부해도')
    expect(FULL_TEXT).toContain('제한이 없습니다')
  })

  it('should mark advertising messages the way the enforcement decree asks', () => {
    // Assert
    expect(FULL_TEXT).toContain('"(광고)" 표시')
    expect(FULL_TEXT).toContain('수신거부')
  })
})

describe('마케팅 문서의 배선', () => {
  it('should be one of the managed policy documents', () => {
    /* `POLICY_FALLBACKS` 는 `Record<LegalSlug, …>` 라 슬러그가 빠지면 타입이 먼저
       깨진다. 여기서는 그 대응이 실제로 채워졌는지만 본다 — `lib/data/legal` 은
       `server-only` 를 끌고 와서 jsdom 에서 import 할 수 없다. */
    expect(Object.keys(POLICY_FALLBACKS)).toContain('marketing')
    expect(POLICY_FALLBACKS.marketing.heading).toBe(MARKETING_CONSENT_HEADING)
    expect(POLICY_FALLBACKS.marketing.title).toBe(MARKETING_CONSENT_TITLE)
    expect(POLICY_FALLBACKS.marketing.sections).toBe(MARKETING_CONSENT_SECTIONS)
  })

  it('should carry a version the DB constraint accepts', () => {
    // Assert — legal_document_versions_version_format: YYYYMMDD[-n]
    expect(MARKETING_CONSENT_VERSION).toMatch(/^[0-9]{8}(-[0-9]{1,2})?$/u)
    expect(MARKETING_CONSENT_EFFECTIVE_DATE).toBe('2026년 9월 18일')
  })

  it('should render a fallback body the dialog can show as HTML', () => {
    // Act
    const html = marketingConsentFallbackHtml()

    // Assert — 발행본이 없을 때도 모달·정책 페이지가 같은 문안을 그린다.
    expect(html).toContain('<h2>5. 야간 전송 제한</h2>')
    expect(html).toContain('제62조의3')
    expect(marketingConsentFallbackHtml()).toBe(html)
  })
})
