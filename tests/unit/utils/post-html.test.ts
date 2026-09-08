import { describe, expect, it } from 'vitest'

import {
  countPostHtmlMedia,
  hasPostHtmlContent,
  postHtmlText,
  renderPostHtml,
} from '@/lib/utils/post-html'

const IMAGE = '<img src="https://cdn.example/post-images/a/b.png" alt="사진" />'
const VIDEO = '<div data-video="youtube:dQw4w9WgXcQ"></div>'

describe('postHtmlText', () => {
  it('should strip tags and keep the reading order', () => {
    // Arrange & Act
    const result = postHtmlText('<h2>제목</h2><p>첫 문단</p><p>둘째 문단</p>')

    // Assert
    expect(result).toBe('제목 첫 문단 둘째 문단')
  })

  it('should decode entities without resurrecting escaped markup', () => {
    // Arrange & Act — `&amp;lt;` 는 화면에 "&lt;" 로 보여야 하는 글자다
    const result = postHtmlText('<p>&lt;script&gt; &amp;amp; &amp;lt;</p>')

    // Assert
    expect(result).toBe('<script> &amp; &lt;')
  })

  it('should return an empty string for an empty editor document', () => {
    // Arrange & Act & Assert
    expect(postHtmlText('<p></p>')).toBe('')
    expect(postHtmlText('<p>   </p>')).toBe('')
  })
})

describe('countPostHtmlMedia / hasPostHtmlContent', () => {
  it('should count images and video placeholders together', () => {
    // Arrange & Act
    const result = countPostHtmlMedia(`${IMAGE}${VIDEO}${IMAGE}`)

    // Assert
    expect(result).toBe(3)
  })

  it('should treat a post with only media as having content', () => {
    // Arrange & Act & Assert
    expect(hasPostHtmlContent(IMAGE)).toBe(true)
    expect(hasPostHtmlContent(VIDEO)).toBe(true)
  })

  it('should treat one character of text as having content', () => {
    // Arrange & Act & Assert
    expect(hasPostHtmlContent('<p>ㅇ</p>')).toBe(true)
  })

  it('should treat an empty document as having no content', () => {
    // Arrange & Act & Assert
    expect(hasPostHtmlContent('<p></p>')).toBe(false)
    expect(hasPostHtmlContent('')).toBe(false)
  })
})

describe('renderPostHtml', () => {
  it('should turn a youtube placeholder into a lazy 16:9 iframe', () => {
    // Arrange & Act
    const result = renderPostHtml(VIDEO)

    // Assert
    expect(result).toContain('class="video-embed"')
    expect(result).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"')
    expect(result).toContain('loading="lazy"')
    expect(result).toContain('title="YouTube 동영상"')
    expect(result).toContain('referrerpolicy="strict-origin-when-cross-origin"')
    expect(result).toContain('allowfullscreen')
  })

  it('should turn a vimeo placeholder into a player iframe', () => {
    // Arrange & Act
    const result = renderPostHtml('<div data-video="vimeo:123456789"></div>')

    // Assert
    expect(result).toContain('src="https://player.vimeo.com/video/123456789"')
  })

  it('should drop a placeholder whose token cannot be parsed', () => {
    // Arrange & Act — 정제기를 통과했더라도 렌더 직전에 한 번 더 검사한다
    const result = renderPostHtml('<div data-video="tiktok:abc123"></div>')

    // Assert
    expect(result).toBe('')
  })

  it('should leave the surrounding markup untouched', () => {
    // Arrange & Act
    const result = renderPostHtml(`<p>앞</p>${VIDEO}<p>뒤</p>`)

    // Assert
    expect(result.startsWith('<p>앞</p>')).toBe(true)
    expect(result.endsWith('<p>뒤</p>')).toBe(true)
  })

  it('should replace every placeholder in the document', () => {
    // Arrange & Act
    const result = renderPostHtml(`${VIDEO}<p>사이</p><div data-video="vimeo:123456789"></div>`)

    // Assert
    expect(result).not.toContain('data-video')
    expect(result.match(/<iframe/gu)).toHaveLength(2)
  })
})
