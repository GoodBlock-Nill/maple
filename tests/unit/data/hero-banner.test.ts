import { describe, expect, it, vi } from 'vitest'

import type { Tables } from '@/types/database.types'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => ({}) }))

const { pickActiveHeroBanner, toHeroBanner } = await import('@/lib/data/hero-banner')

type Row = Tables<'hero_banners'>

const NOW = new Date('2026-09-18T00:00:00.000Z')

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: 'b1',
    title: '9월 업데이트',
    subtitle: '신규 맵 오픈',
    media_type: 'image',
    image_url: '/images/banner.png',
    video_url: null,
    link_url: '/news/1',
    cta_label: null,
    sort_order: 0,
    is_active: true,
    starts_at: null,
    ends_at: null,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('toHeroBanner', () => {
  it('should map an image banner', () => {
    // Arrange / Act
    const banner = toHeroBanner(row())

    // Assert
    expect(banner).toEqual({
      id: 'b1',
      title: '9월 업데이트',
      subtitle: '신규 맵 오픈',
      mediaType: 'image',
      imageUrl: '/images/banner.png',
      youtubeId: null,
      linkUrl: '/news/1',
      ctaLabel: null,
    })
  })

  it('should extract the youtube id from every supported url shape', () => {
    // Arrange
    const urls = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    ]

    // Act / Assert
    for (const url of urls) {
      expect(toHeroBanner(row({ media_type: 'youtube', video_url: url })).youtubeId).toBe(
        'dQw4w9WgXcQ',
      )
    }
  })
})

describe('pickActiveHeroBanner', () => {
  it('should return null when nothing is registered', () => {
    expect(pickActiveHeroBanner([], NOW)).toBeNull()
  })

  it('should return the first row in the given order', () => {
    // Arrange
    const rows = [row({ id: 'first' }), row({ id: 'second' })]

    // Act / Assert
    expect(pickActiveHeroBanner(rows, NOW)?.id).toBe('first')
  })

  it('should skip hidden banners and banners outside their period', () => {
    // Arrange
    const rows = [
      row({ id: 'hidden', is_active: false }),
      row({ id: 'future', starts_at: '2026-10-01T00:00:00.000Z' }),
      row({ id: 'expired', ends_at: '2026-09-17T00:00:00.000Z' }),
      row({ id: 'ok', starts_at: '2026-09-10T00:00:00.000Z', ends_at: '2026-09-30T00:00:00.000Z' }),
    ]

    // Act / Assert
    expect(pickActiveHeroBanner(rows, NOW)?.id).toBe('ok')
  })

  it('should treat the end instant itself as expired', () => {
    // Arrange — 종료 시각과 같은 순간은 더 이상 노출하지 않는다
    const rows = [row({ ends_at: NOW.toISOString() })]

    // Act / Assert
    expect(pickActiveHeroBanner(rows, NOW)).toBeNull()
  })

  it('should skip a youtube banner whose url has no video id', () => {
    // Arrange
    const rows = [
      row({ id: 'broken', media_type: 'youtube', video_url: 'https://example.com/clip' }),
      row({ id: 'ok', media_type: 'youtube', video_url: 'https://youtu.be/dQw4w9WgXcQ' }),
    ]

    // Act / Assert
    expect(pickActiveHeroBanner(rows, NOW)?.id).toBe('ok')
  })

  it('should skip an image banner without an image', () => {
    // Arrange
    const rows = [row({ id: 'no-image', image_url: null }), row({ id: 'ok' })]

    // Act / Assert
    expect(pickActiveHeroBanner(rows, NOW)?.id).toBe('ok')
  })
})
