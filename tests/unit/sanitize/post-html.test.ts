import { describe, expect, it } from 'vitest'

import { sanitizePostHtml } from '@/lib/sanitize/post-html'

/**
 * 정제기는 이 앱의 XSS 방어선 전부다. 여기서 통과한 문자열이 그대로 DB 에 저장되고
 * 상세 화면에서 `dangerouslySetInnerHTML` 로 들어가므로, 새 공격 벡터가 떠오르면
 * 코드보다 이 파일에 먼저 케이스를 추가한다.
 */

const IMAGE_PREFIX = 'https://stub.supabase.co/storage/v1/object/public/post-images/'
const OWN_IMAGE = `${IMAGE_PREFIX}aaaa/2026/photo.png`

function sanitize(html: string): string {
  return sanitizePostHtml(html, { imageUrlPrefix: IMAGE_PREFIX })
}

describe('sanitizePostHtml — 스크립트 실행 경로', () => {
  it('should drop a script tag together with its contents', () => {
    // Arrange & Act
    const result = sanitize('<p>안녕<script>alert(1)</script>하세요</p>')

    // Assert
    expect(result).toBe('<p>안녕하세요</p>')
  })

  it('should drop an inline event handler attribute', () => {
    // Arrange & Act
    const result = sanitize(`<img src="${OWN_IMAGE}" onerror="alert(1)" alt="">`)

    // Assert
    expect(result).not.toContain('onerror')
    expect(result).toContain(OWN_IMAGE)
  })

  it('should drop a javascript: href but keep the visible text', () => {
    // Arrange & Act
    const result = sanitize('<a href="javascript:alert(1)">눌러보세요</a>')

    // Assert
    expect(result).toBe('눌러보세요')
  })

  it('should drop a style tag and inline styles', () => {
    // Arrange & Act
    const result = sanitize('<style>body{display:none}</style><p style="color:red">글</p>')

    // Assert
    expect(result).toBe('<p>글</p>')
  })

  it('should reject a protocol relative link that would inherit the page scheme', () => {
    // Arrange & Act
    const result = sanitize('<a href="//evil.example">링크</a>')

    // Assert
    expect(result).toBe('링크')
  })

  it('should leave a split script tag as escaped text, never as markup', () => {
    // Arrange & Act — `<scr<script>ipt>` 로 파서를 헷갈리게 하려는 시도
    const result = sanitize('<div><span><scr<script>ipt>alert(1)</script></span></div>')

    // Assert — 남는 것은 화면에 글자로 보일 뿐 실행되지 않는다
    expect(result).not.toContain('<script')
    expect(result).not.toContain('<scr')
    expect(result).toBe('ipt&gt;alert(1)')
  })

  it('should drop a noscript and template payload with their contents', () => {
    // Arrange & Act
    const result = sanitize(
      '<noscript><p>숨김</p></noscript><template><p>틀</p></template><p>본문</p>',
    )

    // Assert
    expect(result).toBe('<p>본문</p>')
  })
})

describe('sanitizePostHtml — 이미지', () => {
  it('should keep an image served from our own post-images bucket', () => {
    // Arrange & Act
    const result = sanitize(`<img src="${OWN_IMAGE}" alt="사진" width="800" height="600">`)

    // Assert
    expect(result).toBe(`<img src="${OWN_IMAGE}" alt="사진" width="800" height="600" />`)
  })

  it('should drop an image hosted somewhere else', () => {
    // Arrange & Act — 외부 이미지는 트래킹 픽셀이 될 수 있다
    const result = sanitize('<img src="https://evil.example/pixel.png" alt="">')

    // Assert
    expect(result).toBe('')
  })

  it('should drop a data: URL image', () => {
    // Arrange & Act — data:image/svg+xml 안에는 스크립트를 넣을 수 있다
    const result = sanitize('<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" alt="">')

    // Assert
    expect(result).toBe('')
  })

  it('should drop a non numeric width instead of writing it through', () => {
    // Arrange & Act
    const result = sanitize(`<img src="${OWN_IMAGE}" alt="" width="100%">`)

    // Assert
    expect(result).toBe(`<img src="${OWN_IMAGE}" alt="" />`)
  })
})

describe('sanitizePostHtml — 링크', () => {
  it('should force our rel and target on every external link', () => {
    // Arrange & Act
    const result = sanitize('<a href="https://example.com" rel="opener" target="_self">예시</a>')

    // Assert
    expect(result).toBe(
      '<a href="https://example.com" rel="noopener noreferrer nofollow" target="_blank">예시</a>',
    )
  })
})

describe('sanitizePostHtml — 영상', () => {
  it('should drop a foreign iframe entirely', () => {
    // Arrange & Act
    const result = sanitize('<iframe src="https://evil.example/steal"></iframe>')

    // Assert
    expect(result).toBe('')
  })

  it('should drop even a youtube iframe because videos are stored as placeholders', () => {
    // Arrange & Act
    const result = sanitize('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>')

    // Assert
    expect(result).toBe('')
  })

  it('should keep a well formed video placeholder', () => {
    // Arrange & Act
    const result = sanitize('<div data-video="youtube:dQw4w9WgXcQ"></div>')

    // Assert
    expect(result).toBe('<div data-video="youtube:dQw4w9WgXcQ"></div>')
  })

  it('should keep a vimeo placeholder', () => {
    // Arrange & Act
    const result = sanitize('<div data-video="vimeo:123456789"></div>')

    // Assert
    expect(result).toBe('<div data-video="vimeo:123456789"></div>')
  })

  it('should drop a placeholder whose token is not a known provider', () => {
    // Arrange & Act
    const result = sanitize('<div data-video="javascript:alert(1)">내용</div>')

    // Assert
    expect(result).toBe('내용')
  })

  it('should strip a plain div down to its text', () => {
    // Arrange & Act
    const result = sanitize('<div>본문</div>')

    // Assert
    expect(result).toBe('본문')
  })
})

describe('sanitizePostHtml — 허용 서식', () => {
  it('should keep every tag the editor can produce', () => {
    // Arrange
    const html =
      '<h2>제목</h2><h3>소제목</h3><p><strong>굵게</strong><em>기울임</em><u>밑줄</u><s>취소</s><br /></p>' +
      '<ul><li><p>항목</p></li></ul><ol><li><p>하나</p></li></ol><blockquote><p>인용</p></blockquote>'

    // Act
    const result = sanitize(html)

    // Assert — 서식이 하나도 깎이지 않아야 한다
    expect(result).toBe(html)
  })

  it('should strip tags outside the allow list but keep their text', () => {
    // Arrange & Act
    const result = sanitize('<p>a<b>b</b><h1>c</h1><table><tr><td>d</td></tr></table></p>')

    // Assert
    expect(result).toContain('ab')
    expect(result).not.toContain('<b>')
    expect(result).not.toContain('<h1>')
    expect(result).not.toContain('<table>')
  })
})
