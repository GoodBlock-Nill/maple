import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { POLICY_PROSE_CLASS, policyTocEntries, renderPolicyHtml } from '@/components/legal/legal-prose'
import { sanitizeLegalHtml } from '@/lib/sanitize/legal-html'

/**
 * 정제기는 관리자 저장 경로의 **유일한** 신뢰 경계다. 여기 통과한 문자열만 DB 에
 * 들어가고, 사용자 사이트가 그대로 `dangerouslySetInnerHTML` 로 그린다.
 */

describe('sanitizeLegalHtml', () => {
  it('should keep the whole table shape the editor produces', () => {
    const html = '<table><tbody><tr><th>차수</th></tr><tr><td><p>1차</p></td></tr></tbody></table>'

    expect(sanitizeLegalHtml(html)).toBe(html)
  })

  it('should keep three heading levels', () => {
    expect(sanitizeLegalHtml('<h2>장</h2><h3>절</h3><h4>항</h4>')).toBe(
      '<h2>장</h2><h3>절</h3><h4>항</h4>',
    )
  })

  it('should drop scripts, images and video placeholders', () => {
    expect(sanitizeLegalHtml('<p>본문</p><script>alert(1)</script>')).toBe('<p>본문</p>')
    expect(sanitizeLegalHtml('<img src="https://evil.example/p.gif">')).toBe('')
    expect(sanitizeLegalHtml('<div data-video="youtube:x"></div>')).toBe('')
  })

  it('should force rel and target on links and drop non http schemes', () => {
    expect(sanitizeLegalHtml('<a href="https://example.com">링크</a>')).toBe(
      '<a href="https://example.com" rel="noopener noreferrer nofollow" target="_blank">링크</a>',
    )
    expect(sanitizeLegalHtml('<a href="javascript:alert(1)">눌러</a>')).toBe('눌러')
  })

  it('should strip the colwidth attributes the table extension can leave behind', () => {
    expect(
      sanitizeLegalHtml('<table><tbody><tr><td colwidth="120" colspan="2">셀</td></tr></tbody></table>'),
    ).toBe('<table><tbody><tr><td>셀</td></tr></tbody></table>')
  })
})

describe('renderPolicyHtml', () => {
  it('should number anchors and wrap tables exactly like the client', () => {
    const html = renderPolicyHtml('<h2>가</h2><table><tbody><tr><td>1</td></tr></tbody></table>')

    expect(html).toContain('<h2 id="section-1">가</h2>')
    expect(html).toContain('overflow-x-auto')
    expect(policyTocEntries('<h2>가</h2>')).toEqual([{ id: 'section-1', label: '가' }])
  })
})

/**
 * 사본 표류 감시.
 *
 * 관리자가 저장한 HTML 을 사용자 사이트가 그대로 렌더하고, 미리보기는 사용자
 * 사이트의 클래스를 그대로 쓴다. 두 파일이 갈라지면 "관리자에서는 보이는데 독자
 * 화면에서는 다른" 문서가 생긴다. 워크스페이스 공유 패키지가 없어 파일을 복사해
 * 두었으므로, 원본과 사본이 어긋나면 여기서 깨진다.
 */
describe('사용자 사이트 사본과의 동기화', () => {
  const CLIENT_ROOT = path.join(process.cwd(), '..')

  function slice(filePath: string, start: string, end: string): string {
    const source = readFileSync(filePath, 'utf8')
    const from = source.indexOf(start)
    const to = source.indexOf(end, from)

    expect(from, `${filePath} 에서 "${start}" 를 찾지 못했습니다`).toBeGreaterThanOrEqual(0)
    expect(to, `${filePath} 에서 "${end}" 를 찾지 못했습니다`).toBeGreaterThan(from)

    return source.slice(from, to + end.length)
  }

  it('should keep the legal allow list identical to the client copy', () => {
    const marker = ['const LEGAL_ALLOWED_TAGS = [', '] as const'] as const

    expect(slice(path.join(process.cwd(), 'lib/sanitize/legal-html.ts'), ...marker)).toBe(
      slice(path.join(CLIENT_ROOT, 'lib/sanitize/legal-html.ts'), ...marker),
    )
  })

  it('should keep the sanitize-html options identical to the client copy', () => {
    const marker = [
      'function buildLegalOptions(',
      '    parser: { lowerCaseTags: true, lowerCaseAttributeNames: true },\n  }\n}',
    ] as const

    expect(slice(path.join(process.cwd(), 'lib/sanitize/legal-html.ts'), ...marker)).toBe(
      slice(path.join(CLIENT_ROOT, 'lib/sanitize/legal-html.ts'), ...marker),
    )
  })

  it('should keep the prose classes and render rules identical to the client copy', () => {
    const marker = ['export const POLICY_TABLE_WRAPPER_CLASS', 'return entries\n}'] as const

    expect(slice(path.join(process.cwd(), 'components/legal/legal-prose.ts'), ...marker)).toBe(
      slice(path.join(CLIENT_ROOT, 'components/policy/policy-prose.ts'), ...marker),
    )
  })

  /** 사본을 실제로 임포트해서도 확인한다 — 위 문자열 비교가 통과해도 값이 비면 의미가 없다. */
  it('should expose a prose class that carries the client typography', () => {
    expect(POLICY_PROSE_CLASS).toContain('text-ink-muted text-[17px] leading-[1.8]')
    expect(POLICY_PROSE_CLASS).toContain('[&_p>strong:first-child]:mr-1.5')
  })
})
