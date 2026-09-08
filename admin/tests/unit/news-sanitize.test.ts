import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { postImagePublicUrlPrefix, sanitizePostHtml } from '@/lib/sanitize/post-html'
import { renderPostHtml } from '@/lib/sanitize/render-post-html'
import { parseVideoToken, parseVideoUrl, toVideoToken } from '@/lib/sanitize/video-embed'

/**
 * 정제기는 관리자 저장 경로의 **유일한** 신뢰 경계다. 여기 통과한 문자열만 DB 에
 * 들어가고, 사용자 사이트가 그대로 `dangerouslySetInnerHTML` 로 그린다.
 */

const PREFIX = postImagePublicUrlPrefix('https://example.supabase.co')

function clean(html: string): string {
  return sanitizePostHtml(html, { imageUrlPrefix: PREFIX })
}

describe('sanitizePostHtml — XSS 벡터', () => {
  it('should drop script tags together with their content', () => {
    expect(clean('<p>안녕</p><script>alert(1)</script>')).toBe('<p>안녕</p>')
  })

  it('should drop style, iframe, noscript and template bodies', () => {
    expect(clean('<style>body{display:none}</style>')).toBe('')
    expect(clean('<iframe src="https://evil.example"></iframe>')).toBe('')
    expect(clean('<noscript>x</noscript><template>y</template>')).toBe('')
  })

  it('should strip inline event handlers', () => {
    expect(clean('<p onclick="alert(1)">안녕</p>')).toBe('<p>안녕</p>')
  })

  it('should strip style and class attributes', () => {
    expect(clean('<p style="position:fixed" class="evil">안녕</p>')).toBe('<p>안녕</p>')
  })

  it('should remove a javascript: link but keep its text', () => {
    expect(clean('<a href="javascript:alert(1)">눌러</a>')).toBe('눌러')
  })

  it('should remove a data: link', () => {
    expect(clean('<a href="data:text/html,<script>alert(1)</script>">눌러</a>')).toBe('눌러')
  })

  it('should reject protocol relative urls', () => {
    expect(clean('<a href="//evil.example">눌러</a>')).toBe('눌러')
  })

  it('should force rel and target on surviving links', () => {
    expect(clean('<a href="https://example.com" target="_self">링크</a>')).toBe(
      '<a href="https://example.com" rel="noopener noreferrer nofollow" target="_blank">링크</a>',
    )
  })

  it('should drop images outside our storage bucket', () => {
    expect(clean('<img src="https://evil.example/pixel.gif" alt="">')).toBe('')
    expect(clean('<img src="x" onerror="alert(1)">')).toBe('')
  })

  it('should keep images from our bucket and normalise their attributes', () => {
    const html = `<img src="${PREFIX}uid/2026/a.png" alt="배너" width="640" height="100%">`

    expect(clean(html)).toBe(`<img src="${PREFIX}uid/2026/a.png" alt="배너" width="640" />`)
  })

  it('should strip tags that the editor cannot produce', () => {
    expect(clean('<svg onload="alert(1)"></svg>')).toBe('')
    expect(clean('<table><tr><td>표</td></tr></table>')).toBe('표')
    expect(clean('<h1>제목</h1>')).toBe('제목')
  })

  it('should keep the formatting the editor can produce', () => {
    const html =
      '<h2>제목</h2><p><strong>굵게</strong><em>기울임</em><u>밑줄</u><s>취소</s></p>' +
      '<ul><li>하나</li></ul><blockquote><p>인용</p></blockquote>'

    expect(clean(html)).toBe(html)
  })

  it('should keep a well formed video placeholder', () => {
    expect(clean('<div data-video="youtube:dQw4w9WgXcQ"></div>')).toBe(
      '<div data-video="youtube:dQw4w9WgXcQ"></div>',
    )
  })

  it('should drop a video placeholder with a forged token', () => {
    expect(clean('<div data-video="javascript:alert(1)"></div>')).toBe('')
    expect(clean('<div data-video="youtube:../../etc"></div>')).toBe('')
    expect(clean('<div data-onload="x">감쌈</div>')).toBe('감쌈')
  })

  it('should trim the trailing empty paragraphs the editor leaves behind', () => {
    expect(clean('<p>본문</p><p></p><p></p>')).toBe('<p>본문</p>')
  })
})

describe('video embed tokens', () => {
  it('should read every supported youtube url shape', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    ]) {
      expect(parseVideoUrl(url)).toEqual({ provider: 'youtube', id: 'dQw4w9WgXcQ' })
    }
  })

  it('should read a vimeo url', () => {
    expect(parseVideoUrl('https://vimeo.com/123456789')).toEqual({
      provider: 'vimeo',
      id: '123456789',
    })
  })

  it('should refuse look-alike hosts and non http schemes', () => {
    expect(parseVideoUrl('https://evil.example/?v=dQw4w9WgXcQ')).toBeNull()
    expect(parseVideoUrl('javascript:alert(1)')).toBeNull()
  })

  it('should round trip a token', () => {
    const embed = { provider: 'youtube', id: 'dQw4w9WgXcQ' } as const

    expect(parseVideoToken(toVideoToken(embed))).toEqual(embed)
  })

  it('should refuse a token with an unknown provider or a bad id', () => {
    expect(parseVideoToken('evil:abc123')).toBeNull()
    expect(parseVideoToken('youtube:a"onerror="alert(1)')).toBeNull()
    expect(parseVideoToken('youtube')).toBeNull()
  })
})

/**
 * 사본 표류 감시.
 *
 * 관리자가 저장한 HTML 을 사용자 사이트가 그대로 렌더한다. 두 허용 목록이 갈라지면
 * "관리자에서는 썼는데 독자 화면에서는 사라지는" 태그가 생긴다. 워크스페이스 공유
 * 패키지가 없어 파일을 복사해 두었으므로, 원본과 사본이 어긋나면 여기서 깨진다.
 */
describe('사용자 사이트 정제기와의 동기화', () => {
  const CLIENT_SOURCE = path.join(process.cwd(), '..', 'lib', 'sanitize', 'post-html.ts')
  const ADMIN_SOURCE = path.join(process.cwd(), 'lib', 'sanitize', 'post-html.ts')

  function slice(filePath: string, start: string, end: string): string {
    const source = readFileSync(filePath, 'utf8')
    const from = source.indexOf(start)
    const to = source.indexOf(end, from)

    expect(from, `${filePath} 에서 "${start}" 를 찾지 못했습니다`).toBeGreaterThanOrEqual(0)
    expect(to, `${filePath} 에서 "${end}" 를 찾지 못했습니다`).toBeGreaterThan(from)

    return source.slice(from, to + end.length)
  }

  it('should keep the allowed tag list identical to the client copy', () => {
    const marker = ['const ALLOWED_TAGS = [', '] as const'] as const

    expect(slice(ADMIN_SOURCE, ...marker)).toBe(slice(CLIENT_SOURCE, ...marker))
  })

  it('should keep the sanitize-html options identical to the client copy', () => {
    const marker = [
      'function buildOptions(',
      '    parser: { lowerCaseTags: true, lowerCaseAttributeNames: true },\n  }\n}',
    ] as const

    expect(slice(ADMIN_SOURCE, ...marker)).toBe(slice(CLIENT_SOURCE, ...marker))
  })

  it('should render video placeholders the same way the client does', () => {
    const html = renderPostHtml('<p>본문</p><div data-video="youtube:dQw4w9WgXcQ"></div>')

    expect(html).toContain('class="video-embed"')
    expect(html).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"')
    expect(renderPostHtml('<div data-video="evil:1"></div>')).toBe('')
  })
})
