import { describe, expect, it } from 'vitest'

import { escapeHtml, inlineToHtml, policySectionsToHtml } from '@/lib/content/policy-to-html'
import { OPERATING_POLICY_SECTIONS } from '@/lib/content/operating-policy'
import { PRIVACY_POLICY_SECTIONS } from '@/lib/content/privacy-policy'
import { sanitizeLegalHtml } from '@/lib/sanitize/legal-html'

import type { PolicySection } from '@/lib/content/operating-policy/types'

/**
 * 이 변환기의 출력이 곧 최초 발행본(마이그레이션 시드)이다. 여기서 놓친 글자는
 * 법률 문서에 그대로 박혀 남으므로, 블록 종류마다 결과 문자열을 통째로 못 박는다.
 */

describe('escapeHtml', () => {
  it('should escape the three characters that break markup', () => {
    expect(escapeHtml('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d')
  })

  /* 따옴표를 그대로 두는 것은 의도다 — 정제기가 `&quot;` 를 되돌려 놓아
     "변환기 출력 ≠ 저장값" 이 되기 때문이다(아래 합의 테스트가 그걸 지킨다). */
  it('should leave quotes alone', () => {
    expect(escapeHtml('이하 "운영자"')).toBe('이하 "운영자"')
  })

  it('should escape an ampersand before it becomes part of another entity', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;')
  })
})

describe('inlineToHtml', () => {
  it('should turn the ** marker into strong', () => {
    expect(inlineToHtml('제재는 **영구 이용제한** 입니다')).toBe(
      '제재는 <strong>영구 이용제한</strong> 입니다',
    )
  })

  it('should keep the emphasised text escaped', () => {
    expect(inlineToHtml('**<script>**')).toBe('<strong>&lt;script&gt;</strong>')
  })

  it('should leave a lone asterisk pair alone', () => {
    expect(inlineToHtml('별표 * 하나')).toBe('별표 * 하나')
  })
})

const SECTION: PolicySection = {
  id: 'section-1',
  number: 1,
  title: '기본 원칙',
  blocks: [
    { kind: 'paragraph', code: '[1-1]', text: '운영팀이 **본 정책**을 시행합니다.' },
    { kind: 'paragraph', text: '번호 없는 문단.' },
    { kind: 'list', intro: '대상 행위:', items: ['첫째', '둘째'] },
    {
      kind: 'table',
      code: '①',
      caption: '제재 기준',
      headers: ['차수', '제재'],
      rows: [['1차', '7일']],
    },
  ],
  subsections: [
    {
      id: 'section-1-1',
      title: '1-1. 절',
      blocks: [{ kind: 'list', items: ['항목'] }],
      subsections: [
        { id: 'section-1-1-ga', title: '가. 항', blocks: [{ kind: 'paragraph', text: '내용' }] },
      ],
    },
  ],
}

describe('policySectionsToHtml', () => {
  const html = policySectionsToHtml({ sections: [SECTION] })

  it('should render the chapter heading with its number', () => {
    expect(html.startsWith('<h2>1. 기본 원칙</h2>')).toBe(true)
  })

  it('should put the clause code in a leading strong without a space', () => {
    expect(html).toContain('<p><strong>[1-1]</strong>운영팀이 <strong>본 정책</strong>을 시행합니다.</p>')
  })

  it('should render a list with its intro paragraph in front', () => {
    expect(html).toContain('<p>대상 행위:</p><ul><li>첫째</li><li>둘째</li></ul>')
  })

  it('should render a table with a caption paragraph in front', () => {
    expect(html).toContain(
      '<p><strong>①</strong>제재 기준</p><table><thead><tr><th>차수</th><th>제재</th></tr></thead><tbody><tr><td>1차</td><td>7일</td></tr></tbody></table>',
    )
  })

  it('should map the two subsection depths onto h3 and h4', () => {
    expect(html).toContain('<h3>1-1. 절</h3>')
    expect(html).toContain('<h4>가. 항</h4>')
  })

  it('should not emit id attributes — anchors are added when rendering', () => {
    expect(html).not.toContain('id=')
  })

  it('should append the addendum as one more chapter', () => {
    const withAddendum = policySectionsToHtml({
      sections: [SECTION],
      addendum: { title: '부칙', items: ['효력은 오늘부터.'] },
    })

    expect(withAddendum.endsWith('<h2>부칙</h2><ul><li>효력은 오늘부터.</li></ul>')).toBe(true)
  })
})

/**
 * 시드는 변환기 출력을 **정제기에 한 번 통과시킨** 값이다. 두 단계가 서로 다른
 * 결과를 내면 "시드본은 되는데 관리자에서 저장하면 달라지는" 문서가 생긴다.
 */
describe('변환 결과와 정제기의 합의', () => {
  it('should survive the sanitizer unchanged for both real documents', () => {
    for (const sections of [PRIVACY_POLICY_SECTIONS, OPERATING_POLICY_SECTIONS]) {
      const source = policySectionsToHtml({ sections })

      expect(sanitizeLegalHtml(source)).toBe(source)
    }
  })

  it('should keep every chapter of the privacy policy', () => {
    const source = policySectionsToHtml({ sections: PRIVACY_POLICY_SECTIONS })

    expect(source.match(/<h2>/gu)?.length).toBe(PRIVACY_POLICY_SECTIONS.length)
  })
})
