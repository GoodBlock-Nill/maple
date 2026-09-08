import { describe, expect, it } from 'vitest'

import { markdownToPostHtml } from '@/lib/sanitize/markdown'

/**
 * 레거시 마크다운 글이 수정 화면에 들어올 때의 변환. 결과는 곧바로 에디터에 실리고
 * 저장 시 그대로 DB 로 가므로, 정제기를 통과한 뒤여야 한다.
 */

const IMAGE_PREFIX = 'https://stub.supabase.co/storage/v1/object/public/post-images/'

function convert(markdown: string): Promise<string> {
  return markdownToPostHtml(markdown, { imageUrlPrefix: IMAGE_PREFIX })
}

describe('markdownToPostHtml', () => {
  it('should convert paragraphs and inline emphasis', async () => {
    // Arrange & Act
    const result = await convert('첫 문단\n\n**굵게** 그리고 *기울임*')

    // Assert
    expect(result).toContain('<p>첫 문단</p>')
    expect(result).toContain('<strong>굵게</strong>')
    expect(result).toContain('<em>기울임</em>')
  })

  it('should keep h2 and h3 headings', async () => {
    // Arrange & Act
    const result = await convert('## 제목\n\n### 소제목')

    // Assert
    expect(result).toContain('<h2>제목</h2>')
    expect(result).toContain('<h3>소제목</h3>')
  })

  it('should flatten an h1 because the post title owns that level', async () => {
    // Arrange & Act
    const result = await convert('# 큰 제목')

    // Assert
    expect(result).not.toContain('<h1>')
    expect(result).toContain('큰 제목')
  })

  it('should convert lists', async () => {
    // Arrange & Act
    const result = await convert('- 하나\n- 둘')

    // Assert
    expect(result).toContain('<ul>')
    expect(result).toContain('<li>하나</li>')
  })

  it('should force our link policy on markdown links', async () => {
    // Arrange & Act
    const result = await convert('[예시](https://example.com)')

    // Assert
    expect(result).toContain('rel="noopener noreferrer nofollow"')
    expect(result).toContain('target="_blank"')
  })

  it('should drop a javascript link written in markdown', async () => {
    // Arrange & Act
    const result = await convert('[누르기](javascript:alert(1))')

    // Assert
    expect(result).not.toContain('javascript:')
    expect(result).toContain('누르기')
  })

  it('should drop raw html embedded in the markdown source', async () => {
    // Arrange & Act — 옛 글에 raw HTML 이 섞여 있을 수 있다
    const result = await convert('<script>alert(1)</script>\n\n본문')

    // Assert
    expect(result).not.toContain('<script')
    expect(result).not.toContain('alert(1)')
    expect(result).toContain('본문')
  })

  it('should drop an image that is not hosted in our bucket', async () => {
    // Arrange & Act
    const result = await convert('![사진](https://evil.example/pixel.png)')

    // Assert
    expect(result).not.toContain('<img')
  })

  it('should keep an image already stored in our bucket', async () => {
    // Arrange & Act
    const result = await convert(`![사진](${IMAGE_PREFIX}a/2026/b.png)`)

    // Assert
    expect(result).toContain(`<img src="${IMAGE_PREFIX}a/2026/b.png"`)
  })

  it('should return an empty string for empty markdown', async () => {
    // Arrange & Act & Assert
    expect(await convert('')).toBe('')
  })
})
