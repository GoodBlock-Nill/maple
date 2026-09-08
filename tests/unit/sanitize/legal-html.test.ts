import { describe, expect, it } from 'vitest'

import { sanitizeLegalHtml } from '@/lib/sanitize/legal-html'

/**
 * 정제기는 약관 저장 경로의 **유일한** 신뢰 경계다. 여기 통과한 문자열만 DB 에
 * 들어가고, 사용자 사이트가 그대로 `dangerouslySetInnerHTML` 로 그린다.
 */

describe('sanitizeLegalHtml — XSS 벡터', () => {
  it('should drop script tags together with their content', () => {
    expect(sanitizeLegalHtml('<p>안녕</p><script>alert(1)</script>')).toBe('<p>안녕</p>')
  })

  it('should drop style, iframe, noscript and template bodies', () => {
    expect(sanitizeLegalHtml('<style>body{display:none}</style>')).toBe('')
    expect(sanitizeLegalHtml('<iframe src="https://evil.example"></iframe>')).toBe('')
    expect(sanitizeLegalHtml('<noscript>x</noscript><template>y</template>')).toBe('')
  })

  it('should strip inline event handlers, style and class', () => {
    expect(sanitizeLegalHtml('<p onclick="alert(1)" style="position:fixed" class="evil">안녕</p>')).toBe(
      '<p>안녕</p>',
    )
  })

  it('should remove javascript, data and protocol relative links but keep their text', () => {
    expect(sanitizeLegalHtml('<a href="javascript:alert(1)">눌러</a>')).toBe('눌러')
    expect(sanitizeLegalHtml('<a href="data:text/html,x">눌러</a>')).toBe('눌러')
    expect(sanitizeLegalHtml('<a href="//evil.example">눌러</a>')).toBe('눌러')
  })

  it('should force rel and target on surviving links', () => {
    expect(sanitizeLegalHtml('<a href="https://example.com" target="_self">링크</a>')).toBe(
      '<a href="https://example.com" rel="noopener noreferrer nofollow" target="_blank">링크</a>',
    )
  })

  it('should drop images — legal documents never carry them', () => {
    expect(sanitizeLegalHtml('<img src="https://evil.example/pixel.gif" alt="">')).toBe('')
  })
})

describe('sanitizeLegalHtml — 허용 목록', () => {
  it('should keep the whole table shape', () => {
    const html =
      '<table><thead><tr><th>차수</th></tr></thead><tbody><tr><td>1차</td></tr></tbody></table>'

    expect(sanitizeLegalHtml(html)).toBe(html)
  })

  it('should keep three heading levels, lists, emphasis and breaks', () => {
    const html =
      '<h2>장</h2><h3>절</h3><h4>항</h4><p><strong>굵게</strong><em>기울임</em><br /></p>' +
      '<ul><li>하나</li></ul><ol><li>둘</li></ol>'

    expect(sanitizeLegalHtml(html)).toBe(html)
  })

  it('should strip anchors ids — the renderer assigns them', () => {
    expect(sanitizeLegalHtml('<h2 id="mine">장</h2>')).toBe('<h2>장</h2>')
  })

  it('should strip cell spans so the fixed row layout keeps holding', () => {
    expect(sanitizeLegalHtml('<table><tbody><tr><td colspan="2">셀</td></tr></tbody></table>')).toBe(
      '<table><tbody><tr><td>셀</td></tr></tbody></table>',
    )
  })

  it('should strip what the legal editor cannot produce', () => {
    expect(sanitizeLegalHtml('<h1>제목</h1>')).toBe('제목')
    expect(sanitizeLegalHtml('<blockquote><p>인용</p></blockquote>')).toBe('<p>인용</p>')
    expect(sanitizeLegalHtml('<div data-video="youtube:x"></div>')).toBe('')
    expect(sanitizeLegalHtml('<svg onload="alert(1)"></svg>')).toBe('')
  })

  it('should trim the trailing empty paragraphs the editor leaves behind', () => {
    expect(sanitizeLegalHtml('<p>본문</p><p></p><p></p>')).toBe('<p>본문</p>')
  })
})
