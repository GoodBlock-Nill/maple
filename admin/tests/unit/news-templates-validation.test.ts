import { describe, expect, it } from 'vitest'

import { NEWS_CATEGORY_KEYS, NEWS_SUMMARY_MAX, NEWS_TITLE_MAX } from '@/lib/constants/news'
import { NEWS_TEMPLATE_SEEDS, newsTemplateSeed } from '@/lib/constants/news-templates'
import {
  NEWS_TEMPLATE_BODY_MAX,
  NEWS_TEMPLATE_SUMMARY_MAX,
  NEWS_TEMPLATE_TITLE_MAX,
  newsTemplateSchema,
  parseNewsTemplateCategory,
} from '@/lib/validation/news-templates'

/**
 * 카테고리 템플릿의 입력 계약.
 *
 * 고정하는 것은 둘이다.
 *   1. 상한이 **뉴스 글 필드와 같은 숫자**다. 어긋나면 "불러왔는데 글로는 저장할 수 없는"
 *      템플릿이 만들어진다.
 *   2. 시드(코드 기본값)가 그 상한 안에 있다. '기본값으로 되돌리기' 가 스키마·DB CHECK 에
 *      걸리면 되돌릴 방법이 사라진다.
 */

function input(overrides: Record<string, unknown> = {}) {
  return {
    category: 'maintenance',
    title: '[점검] 안내',
    summary: '',
    body: '<p>본문</p>',
    isActive: true,
    ...overrides,
  }
}

describe('newsTemplateSchema', () => {
  it('should keep the same limits as the news post fields', () => {
    // Arrange & Act & Assert — 숫자를 따로 정하면 두 화면이 다른 말을 한다.
    expect(NEWS_TEMPLATE_TITLE_MAX).toBe(NEWS_TITLE_MAX)
    expect(NEWS_TEMPLATE_SUMMARY_MAX).toBe(NEWS_SUMMARY_MAX)
  })

  it('should accept a full template', () => {
    // Arrange & Act
    const parsed = newsTemplateSchema.safeParse(input({ summary: '요약', isActive: false }))

    // Assert
    expect(parsed.success).toBe(true)
    expect(parsed.data?.isActive).toBe(false)
  })

  it('should accept an empty body (제목만 정해 두는 카테고리)', () => {
    // Arrange & Act
    const parsed = newsTemplateSchema.safeParse(input({ body: '' }))

    // Assert
    expect(parsed.success).toBe(true)
    expect(parsed.data?.body).toBe('')
  })

  it('should reject an unknown category', () => {
    // Arrange & Act — 없는 카테고리는 FK 가 막는다. 그전에 여기서 먼저 돌려보낸다.
    const parsed = newsTemplateSchema.safeParse(input({ category: 'nope' }))

    // Assert
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toBe('카테고리를 선택해 주세요.')
  })

  it('should reject a title over the post title limit', () => {
    // Arrange
    const tooLong = 'ㄱ'.repeat(NEWS_TITLE_MAX + 1)

    // Act
    const parsed = newsTemplateSchema.safeParse(input({ title: tooLong }))

    // Assert
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toContain(`${NEWS_TEMPLATE_TITLE_MAX}자`)
  })

  it('should reject a summary over the post summary limit', () => {
    // Arrange & Act
    const parsed = newsTemplateSchema.safeParse(
      input({ summary: 'ㄱ'.repeat(NEWS_SUMMARY_MAX + 1) }),
    )

    // Assert
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toContain(`${NEWS_TEMPLATE_SUMMARY_MAX}자`)
  })

  it('should reject a body over the template limit', () => {
    // Arrange & Act — DB CHECK(20000)과 같은 숫자라 여기서 먼저 걸린다.
    const parsed = newsTemplateSchema.safeParse(
      input({ body: `<p>${'가'.repeat(NEWS_TEMPLATE_BODY_MAX)}</p>` }),
    )

    // Assert
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toContain('본문 템플릿')
  })

  it('should normalise CRLF and trim', () => {
    // Arrange & Act — 에디터·DB 가 한 모양(LF)만 보게 한다.
    const parsed = newsTemplateSchema.safeParse(input({ body: '  <p>가</p>\r\n<p>나</p>  ' }))

    // Assert
    expect(parsed.data?.body).toBe('<p>가</p>\n<p>나</p>')
  })
})

describe('parseNewsTemplateCategory', () => {
  it('should narrow a known route param', () => {
    // Arrange & Act & Assert
    expect(parseNewsTemplateCategory('patch')).toBe('patch')
  })

  it('should return null for an unknown route param', () => {
    // Arrange & Act & Assert — 라우트가 404 로 떨어지는 근거다.
    expect(parseNewsTemplateCategory('../etc')).toBeNull()
  })
})

describe('기본 템플릿 시드', () => {
  it('should cover every news category', () => {
    // Arrange & Act & Assert — 카테고리가 늘면 시드도 함께 늘어야 한다.
    expect(Object.keys(NEWS_TEMPLATE_SEEDS).sort()).toEqual([...NEWS_CATEGORY_KEYS].sort())
  })

  it('should parse through the same schema the form uses', () => {
    for (const category of NEWS_CATEGORY_KEYS) {
      // Arrange
      const seed = newsTemplateSeed(category)

      // Act
      const parsed = newsTemplateSchema.safeParse({
        category,
        title: seed.title,
        summary: seed.summary,
        body: seed.body,
        isActive: true,
      })

      // Assert — 되돌리기가 스키마에 걸리면 기본값으로 돌아갈 방법이 사라진다.
      expect(parsed.success, `${category} 시드가 스키마를 통과하지 못했습니다`).toBe(true)
    }
  })

  it('should give every category a title and a body to start from', () => {
    for (const category of NEWS_CATEGORY_KEYS) {
      // Arrange & Act
      const seed = newsTemplateSeed(category)

      // Assert — 빈 시드는 "템플릿이 있는데 아무 일도 안 하는" 카테고리를 만든다.
      expect(seed.title, `${category} 제목 시드`).not.toBe('')
      expect(seed.body, `${category} 본문 시드`).not.toBe('')
    }
  })

  it('should only use tags the post sanitizer keeps', () => {
    // Arrange — 정제기 허용 목록(lib/sanitize/post-html.ts)과 같은 집합.
    const allowed = new Set(['p', 'br', 'strong', 'em', 's', 'u', 'h2', 'h3', 'ul', 'ol', 'li'])

    for (const category of NEWS_CATEGORY_KEYS) {
      // Act
      const tags = [...newsTemplateSeed(category).body.matchAll(/<\/?([a-z0-9]+)/gu)].map(
        (match) => match[1],
      )

      // Assert — 여기 없는 태그는 저장 시 사라져, 되돌린 직후 저장하면 문단이 없어진다.
      for (const tag of tags) {
        expect(allowed.has(tag ?? ''), `${category} 본문에 ${tag} 태그가 있습니다`).toBe(true)
      }
    }
  })

  it('should fall back to an empty template for an unknown key', () => {
    // Arrange & Act & Assert — 모르는 카테고리에서도 폼이 깨지지 않는다.
    expect(newsTemplateSeed('nope')).toEqual({ title: '', summary: '', body: '' })
  })
})
