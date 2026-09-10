import { describe, expect, it } from 'vitest'

import { PRIVACY_POLICY_SECTIONS, PRIVACY_POLICY_VERSION } from '@/lib/content/privacy-policy'

import type { PolicyBlock, PolicySection, PolicySubsection } from '@/lib/content/privacy-policy'

/** 소스로 참고했던 문서의 표기가 남아 있으면 안 되는 금칙어 목록. */
const FORBIDDEN_STRINGS = ['메이플플래닛', 'MaplePlanet', 'mapleplanet', 'Toben']

/** 블록 하나에서 화면에 그려지는 모든 텍스트를 모은다. */
function collectBlockText(block: PolicyBlock): string[] {
  if (block.kind === 'paragraph') {
    return [block.text]
  }

  if (block.kind === 'list') {
    return [...(block.intro !== undefined ? [block.intro] : []), ...block.items]
  }

  return [
    ...(block.caption !== undefined ? [block.caption] : []),
    ...block.headers,
    ...block.rows.flat(),
  ]
}

/** 하위 항목(subsection)까지 재귀적으로 순회하며 텍스트를 모은다. */
function collectSubsectionText(subsection: PolicySubsection): string[] {
  return [
    subsection.title,
    ...subsection.blocks.flatMap(collectBlockText),
    ...(subsection.subsections ?? []).flatMap(collectSubsectionText),
  ]
}

function collectSectionText(section: PolicySection): string[] {
  return [
    section.title,
    ...section.blocks.flatMap(collectBlockText),
    ...(section.subsections ?? []).flatMap(collectSubsectionText),
  ]
}

describe('PRIVACY_POLICY_SECTIONS', () => {
  it('should give every section a non-empty id and title', () => {
    // Arrange & Act
    const sections = PRIVACY_POLICY_SECTIONS

    // Assert
    expect(sections.length).toBeGreaterThan(0)
    for (const section of sections) {
      expect(section.id.trim()).not.toBe('')
      expect(section.title.trim()).not.toBe('')
    }
  })

  it('should number sections sequentially starting at 1', () => {
    // Arrange
    const sections = PRIVACY_POLICY_SECTIONS

    // Act
    const numbers = sections.map((section) => section.number)

    // Assert
    expect(numbers).toEqual(sections.map((_, index) => index + 1))
  })

  it('should give every subsection a non-empty id and title', () => {
    // Arrange
    const subsections = PRIVACY_POLICY_SECTIONS.flatMap((section) => section.subsections ?? [])

    // Act & Assert
    for (const subsection of subsections) {
      expect(subsection.id.trim()).not.toBe('')
      expect(subsection.title.trim()).not.toBe('')
    }
  })

  it('should not leak the source document this content was adapted from', () => {
    // Arrange
    const allText = PRIVACY_POLICY_SECTIONS.flatMap(collectSectionText).join('\n')

    // Act & Assert
    for (const forbidden of FORBIDDEN_STRINGS) {
      expect(allText).not.toContain(forbidden)
    }
  })
})

/**
 * 회원 탈퇴 90일 보존·파기 규정(docs/admin/ACCOUNT-WITHDRAWAL-PLAN.md §4.2).
 * 화면 문구(탈퇴 모달 · 복구 안내)와 방침이 같은 숫자를 말해야 한다.
 */
describe('회원 탈퇴 보존·파기 규정', () => {
  const section4 = PRIVACY_POLICY_SECTIONS.find((section) => section.number === 4)
  const section7 = PRIVACY_POLICY_SECTIONS.find((section) => section.number === 7)

  it('should state the 90-day retention after a withdrawal request in §4', () => {
    const text = (section4 === undefined ? [] : collectSectionText(section4)).join('\n')

    expect(text).toContain('재가입에 대비해 90일간 보존한 뒤 지체 없이 파기')
    expect(text).toContain(
      '이메일, 간편로그인 식별자, 닉네임, 월드 계정 UID, 프로필 코드, 프로필 사진',
    )
    expect(text).toContain('비식별화("탈퇴한 회원")')
  })

  it('should keep the statutory retention rows intact', () => {
    const text = (section4 === undefined ? [] : collectSectionText(section4)).join('\n')

    expect(text).toContain('3년')
    expect(text).toContain('3개월')
    expect(text).toContain('회원 탈퇴 후 1년')
  })

  it('should mention the daily automatic purge batch in §7', () => {
    const text = (section7 === undefined ? [] : collectSectionText(section7)).join('\n')

    expect(text).toContain('매일 자동 배치로')
  })
})

/**
 * 개인정보 보호책임자 연락처 변경(2026-09-10, 시행일은 그대로 9/18).
 * §8 은 §12 를 가리키는 조문 번호 참조가 실제 조문 번호와 일치해야 한다.
 */
describe('개인정보 보호책임자 연락처', () => {
  const section8 = PRIVACY_POLICY_SECTIONS.find((section) => section.number === 8)
  const section12 = PRIVACY_POLICY_SECTIONS.find((section) => section.number === 12)

  it('should publish the current officer contact in §12', () => {
    const text = (section12 === undefined ? [] : collectSectionText(section12)).join('\n')

    expect(text).toContain('담당자: 글자월드 관리자')
    expect(text).toContain('이메일: care@gjstory.com')
    expect(text).not.toContain('글자월드 운영자')
    expect(text).not.toContain('contact@글자월드.co.kr')
  })

  it('should reference §12 (not §10) as the officer section in §8', () => {
    const text = (section8 === undefined ? [] : collectSectionText(section8)).join('\n')

    expect(text).toContain('제12조의 개인정보 보호책임자 이메일')
    expect(text).not.toContain('제10조의 개인정보 보호책임자')
  })

  it('should bump the document version while keeping the effective date', () => {
    expect(PRIVACY_POLICY_VERSION).toBe('20260918-4')
  })
})
