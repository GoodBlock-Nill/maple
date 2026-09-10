import { describe, expect, it } from 'vitest'

import { POLICY_FALLBACKS } from '@/lib/content/policy-fallback'
import {
  PRIVACY_POLICY_EFFECTIVE_DATE,
  PRIVACY_POLICY_NOTICE,
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_VERSION,
} from '@/lib/content/privacy-policy'

import { ARTICLE_TITLES, collectSectionText } from './privacy-policy-helpers'

/**
 * 문서의 뼈대 — 조문 수·순서·제목과 발행 메타데이터.
 *
 * 원문은 `docs/개인정보처리방침_글자월드_v1_0.pdf`(v1.0, 시행일 2026.09.18).
 * 조문별 문안은 `privacy-policy-articles.test.ts` 가 본다.
 */

/** 소스로 참고했던 문서의 표기가 남아 있으면 안 되는 금칙어 목록. */
const FORBIDDEN_STRINGS = ['메이플플래닛', 'MaplePlanet', 'mapleplanet']

const ALL_TEXT = PRIVACY_POLICY_SECTIONS.flatMap(collectSectionText).join('\n')

describe('PRIVACY_POLICY_SECTIONS', () => {
  it('should carry all 14 articles of the v1.0 document in order', () => {
    // Act
    const titles = PRIVACY_POLICY_SECTIONS.map((entry) => entry.title)

    // Assert
    expect(PRIVACY_POLICY_SECTIONS).toHaveLength(14)
    expect(titles).toEqual(ARTICLE_TITLES)
  })

  it('should number sections sequentially starting at 1', () => {
    // Arrange
    const sections = PRIVACY_POLICY_SECTIONS

    // Act
    const numbers = sections.map((entry) => entry.number)

    // Assert
    expect(numbers).toEqual(sections.map((_, index) => index + 1))
  })

  it('should give every section and subsection a non-empty id and title', () => {
    // Arrange
    const subsections = PRIVACY_POLICY_SECTIONS.flatMap((entry) => entry.subsections ?? [])

    // Act & Assert
    for (const entry of PRIVACY_POLICY_SECTIONS) {
      expect(entry.id.trim()).not.toBe('')
      expect(entry.title.trim()).not.toBe('')
    }

    for (const subsection of subsections) {
      expect(subsection.id.trim()).not.toBe('')
      expect(subsection.title.trim()).not.toBe('')
    }
  })

  it('should not leak the source document this content was adapted from', () => {
    // Act & Assert
    for (const forbidden of FORBIDDEN_STRINGS) {
      expect(ALL_TEXT).not.toContain(forbidden)
    }
  })

  /* 지식재산권 고지는 `site_settings.ip_notice` 가 단일 출처다. 본문에도 담으면
     같은 문구가 페이지에 두 번 나온다(`hasIpNotice` 가 말미에 덧붙인다). */
  it('should leave the intellectual property notice out of the body', () => {
    // Assert
    expect(ALL_TEXT).not.toContain('지식재산권')
    expect(ALL_TEXT).not.toContain('NEXON Korea Corp.')
    expect(POLICY_FALLBACKS.privacy.hasIpNotice).toBe(true)
  })
})

describe('머리말(PRIVACY_POLICY_NOTICE)', () => {
  it('should state the scope of the policy before the first article', () => {
    // Arrange
    const text = PRIVACY_POLICY_NOTICE.lines.join('\n')

    // Assert
    expect(PRIVACY_POLICY_NOTICE.lines).toHaveLength(2)
    expect(text).toContain('https://www.gjstory.com')
    expect(text).toContain('「개인정보 보호법」')
    expect(text).toContain('메이플스토리 월드 운영사(Toben Studio Inc.)')
  })

  it('should hand the notice and the sections to the privacy fallback', () => {
    // Assert
    expect(POLICY_FALLBACKS.privacy.notice).toBe(PRIVACY_POLICY_NOTICE)
    expect(POLICY_FALLBACKS.privacy.sections).toBe(PRIVACY_POLICY_SECTIONS)
  })
})

describe('발행 메타데이터', () => {
  it('should publish v1.0 as 20260918-5 with the same effective date', () => {
    // Assert
    expect(PRIVACY_POLICY_VERSION).toBe('20260918-5')
    expect(PRIVACY_POLICY_EFFECTIVE_DATE).toBe('2026년 9월 18일')
    expect(POLICY_FALLBACKS.privacy.version).toBe(PRIVACY_POLICY_VERSION)
  })
})
