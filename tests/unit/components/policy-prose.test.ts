import { describe, expect, it } from 'vitest'

import {
  POLICY_PROSE_CLASS,
  POLICY_TABLE_WRAPPER_CLASS,
  policySectionAnchor,
  policyTocEntries,
  renderPolicyHtml,
} from '@/components/policy/policy-prose'

/**
 * 렌더 규칙은 저장된 HTML 을 화면에 붙이기 직전의 마지막 손질이다. 앵커 규칙이
 * 어긋나면 목차 링크가 조용히 죽고, 표 래퍼가 빠지면 좁은 화면에서 표가 카드를
 * 뚫고 나간다.
 */

describe('renderPolicyHtml', () => {
  it('should number h2 anchors in document order', () => {
    expect(renderPolicyHtml('<h2>가</h2><p>x</p><h2>나</h2>')).toBe(
      '<h2 id="section-1">가</h2><p>x</p><h2 id="section-2">나</h2>',
    )
  })

  it('should wrap every table in the horizontal scroll box', () => {
    const html = renderPolicyHtml('<table><tbody><tr><td>1</td></tr></tbody></table>')

    expect(html).toBe(
      `<div class="${POLICY_TABLE_WRAPPER_CLASS}"><table><tbody><tr><td>1</td></tr></tbody></table></div>`,
    )
  })

  it('should leave documents without headings or tables untouched', () => {
    expect(renderPolicyHtml('<p>안내</p>')).toBe('<p>안내</p>')
  })
})

describe('policyTocEntries', () => {
  it('should read one entry per chapter with matching anchors', () => {
    expect(policyTocEntries('<h2>1. 총칙</h2><p>x</p><h2>2. 수집</h2>')).toEqual([
      { id: 'section-1', label: '1. 총칙' },
      { id: 'section-2', label: '2. 수집' },
    ])
  })

  it('should strip inline markup and decode entities in the label', () => {
    expect(policyTocEntries('<h2>3. <strong>제재</strong> &amp; 이의</h2>')).toEqual([
      { id: 'section-1', label: '3. 제재 & 이의' },
    ])
  })

  it('should ignore lower headings', () => {
    expect(policyTocEntries('<h2>장</h2><h3>절</h3><h4>항</h4>')).toHaveLength(1)
  })

  it('should agree with the anchors renderPolicyHtml writes', () => {
    const source = '<h2>가</h2><h2>나</h2><h2>다</h2>'

    for (const entry of policyTocEntries(source)) {
      expect(renderPolicyHtml(source)).toContain(`id="${entry.id}"`)
    }

    expect(policySectionAnchor(0)).toBe('section-1')
  })
})

/**
 * 서식 값이 `PolicyBlockView`/`PolicySectionArticle` 에서 왔다는 사실을 못 박는다.
 * 하나라도 빠지면 발행본과 폴백 화면이 갈라진다.
 */
describe('POLICY_PROSE_CLASS', () => {
  it('should carry the body, table and heading rules the code renderer uses', () => {
    for (const expected of [
      'text-ink-muted text-[17px] leading-[1.8]',
      '[&>h2]:text-[22px]',
      'sm:[&>h2]:text-[27px]',
      '[&>h3]:text-[19px]',
      '[&>h4]:text-[17px]',
      "[&_ul>li]:marker:content-['–_']",
      '[&_p>strong:first-child]:mr-1.5',
      '[&_th]:text-table-head',
      '[&_td]:border-table-line',
    ]) {
      expect(POLICY_PROSE_CLASS).toContain(expected)
    }
  })
})
