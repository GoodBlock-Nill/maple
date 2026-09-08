import { describe, expect, it } from 'vitest'

import { PRIVACY_POLICY_SECTIONS } from '@/lib/content/privacy-policy'

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
