import { describe, expect, it } from 'vitest'

import {
  deriveNewsStatus,
  deriveNewsVisibility,
  isNewsCategoryKey,
  NEWS_CATEGORIES,
  NEWS_STATUS_LABEL,
  NEWS_VISIBILITY_LABEL,
  newsAuditSnapshot,
  newsCategoryLabel,
} from '@/lib/constants/news'

/** 판정 기준 시각. 예약/발행 경계를 이 값으로 고정한다. */
const NOW = new Date('2026-09-08T12:00:00.000Z')

const PUBLISHED = {
  isPublished: true,
  publishedAt: '2026-09-01T00:00:00.000Z',
  isHidden: false,
  deletedAt: null,
}

describe('deriveNewsStatus', () => {
  it('should report published when the publish time has passed', () => {
    expect(deriveNewsStatus(PUBLISHED, NOW)).toBe('published')
  })

  it('should report scheduled when the publish time is still ahead', () => {
    const status = deriveNewsStatus({ ...PUBLISHED, publishedAt: '2026-09-09T00:00:00.000Z' }, NOW)

    expect(status).toBe('scheduled')
  })

  it('should report draft when the post is not published', () => {
    expect(deriveNewsStatus({ ...PUBLISHED, isPublished: false }, NOW)).toBe('draft')
  })

  it('should let hidden win over the publish state', () => {
    expect(deriveNewsStatus({ ...PUBLISHED, isHidden: true }, NOW)).toBe('hidden')
  })

  it('should let deleted win over hidden', () => {
    const status = deriveNewsStatus(
      { ...PUBLISHED, isHidden: true, deletedAt: '2026-09-08T00:00:00.000Z' },
      NOW,
    )

    expect(status).toBe('deleted')
  })

  it('should treat the exact publish moment as published, not scheduled', () => {
    expect(deriveNewsStatus({ ...PUBLISHED, publishedAt: NOW.toISOString() }, NOW)).toBe('published')
  })
})

describe('newsAuditSnapshot', () => {
  it('should keep only the title, category and status', () => {
    const snapshot = newsAuditSnapshot(
      {
        title: '점검 안내',
        category_key: 'maintenance',
        is_published: true,
        published_at: '2026-09-01T00:00:00.000Z',
        is_hidden: false,
        deleted_at: null,
      },
      NOW,
    )

    expect(snapshot).toEqual({
      title: '점검 안내',
      category_key: 'maintenance',
      status: 'published',
    })
  })
})

describe('news categories', () => {
  it('should expose the six categories in migration order', () => {
    expect(NEWS_CATEGORIES.map((category) => category.key)).toEqual([
      'notice',
      'maintenance',
      'update',
      'patch',
      'event',
      'info',
    ])
  })

  it('should reject a key outside the allow list', () => {
    expect(isNewsCategoryKey('notice')).toBe(true)
    expect(isNewsCategoryKey('chat')).toBe(false)
  })

  it('should fall back to the raw key when the category is unknown', () => {
    expect(newsCategoryLabel('maintenance')).toBe('점검안내')
    expect(newsCategoryLabel('legacy')).toBe('legacy')
  })

  it('should label every status', () => {
    expect(NEWS_STATUS_LABEL.scheduled).toBe('예약')
    expect(NEWS_STATUS_LABEL.deleted).toBe('삭제')
  })
})

/**
 * 노출 여부는 사용자 사이트의 목록 쿼리·SELECT 정책과 **같은 판정식**이어야 한다.
 *   is_published AND deleted_at IS NULL AND NOT is_hidden AND published_at <= now()
 */
describe('deriveNewsVisibility', () => {
  it('should show a published post whose time has passed', () => {
    expect(deriveNewsVisibility(PUBLISHED, NOW)).toBe('visible')
  })

  it('should mark a future publish time as scheduled, not visible', () => {
    const visibility = deriveNewsVisibility(
      { ...PUBLISHED, publishedAt: '2026-09-09T00:00:00.000Z' },
      NOW,
    )

    expect(visibility).toBe('scheduled')
  })

  it('should hide drafts, hidden posts and deleted posts alike', () => {
    expect(deriveNewsVisibility({ ...PUBLISHED, isPublished: false }, NOW)).toBe('invisible')
    expect(deriveNewsVisibility({ ...PUBLISHED, isHidden: true }, NOW)).toBe('invisible')
    expect(deriveNewsVisibility({ ...PUBLISHED, deletedAt: NOW.toISOString() }, NOW)).toBe(
      'invisible',
    )
  })

  it('should hide a scheduled post that was also hidden', () => {
    const visibility = deriveNewsVisibility(
      { ...PUBLISHED, publishedAt: '2026-09-09T00:00:00.000Z', isHidden: true },
      NOW,
    )

    expect(visibility).toBe('invisible')
  })

  it('should label every visibility', () => {
    expect(NEWS_VISIBILITY_LABEL.visible).toBe('노출 중')
    expect(NEWS_VISIBILITY_LABEL.scheduled).toBe('예약')
    expect(NEWS_VISIBILITY_LABEL.invisible).toBe('비노출')
  })
})
