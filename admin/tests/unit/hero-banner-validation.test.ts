import { describe, expect, it } from 'vitest'

import { heroBannerSchema, movedOrder, toHeroBannerRow } from '@/lib/validation/hero-banner'

const IMAGE_BANNER = {
  title: '오픈 안내',
  subtitle: '',
  mediaType: 'image',
  imageUrl: '/images/banner.png',
  videoUrl: '',
  linkUrl: '/news',
  ctaLabel: '자세히',
  sortOrder: '0',
  isActive: true,
  startsAt: '2026-09-08T10:00',
  endsAt: '2026-09-09T10:00',
}

const VIDEO_BANNER = {
  ...IMAGE_BANNER,
  mediaType: 'youtube',
  imageUrl: '',
  videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
}

describe('heroBannerSchema', () => {
  it('should accept a scheduled image banner', () => {
    const parsed = heroBannerSchema.parse(IMAGE_BANNER)

    expect(parsed.sortOrder).toBe(0)
    expect(parsed.startsAt).toBe('2026-09-08T01:00:00.000Z')
    expect(parsed.mediaType).toBe('image')
    expect(parsed.videoUrl).toBeNull()
  })

  it('should require an image for an image banner', () => {
    const result = heroBannerSchema.safeParse({ ...IMAGE_BANNER, imageUrl: '' })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['imageUrl'])
  })

  it('should treat a missing media type as an image banner', () => {
    // 미디어 유형이 없던 시절의 저장 요청(직접 POST)도 그대로 통과해야 한다.
    expect(heroBannerSchema.parse({ ...IMAGE_BANNER, mediaType: '' }).mediaType).toBe('image')
  })

  it('should reject an unknown media type', () => {
    expect(heroBannerSchema.safeParse({ ...IMAGE_BANNER, mediaType: 'vimeo' }).success).toBe(false)
  })

  it('should accept a youtube banner without a poster', () => {
    const parsed = heroBannerSchema.parse(VIDEO_BANNER)

    expect(parsed.mediaType).toBe('youtube')
    expect(parsed.videoUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(parsed.imageUrl).toBeNull()
  })

  it('should accept a youtube banner with a poster image', () => {
    const parsed = heroBannerSchema.parse({ ...VIDEO_BANNER, imageUrl: '/images/poster.png' })

    expect(parsed.imageUrl).toBe('/images/poster.png')
    expect(parsed.videoUrl).toContain('dQw4w9WgXcQ')
  })

  it('should require a video url for a youtube banner', () => {
    const result = heroBannerSchema.safeParse({ ...VIDEO_BANNER, videoUrl: '' })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['videoUrl'])
    expect(result.error?.issues[0]?.message).toContain('유튜브 주소를 입력')
  })

  it('should reject a video url it cannot read as a youtube video', () => {
    const result = heroBannerSchema.safeParse({
      ...VIDEO_BANNER,
      videoUrl: 'https://vimeo.com/123456789',
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['videoUrl'])
  })

  it('should drop the video url when the banner goes back to an image', () => {
    /* 유형만 되돌린 뒤 다시 영상으로 바꿨을 때 옛 영상이 되살아나면 안 된다. */
    const parsed = heroBannerSchema.parse({
      ...IMAGE_BANNER,
      videoUrl: 'https://youtu.be/dQw4w9WgXcQ',
    })

    expect(parsed.videoUrl).toBeNull()
  })

  it('should reject an end that precedes the start', () => {
    // DB 의 hero_banners_period 제약과 같은 규칙을 화면에서 먼저 알려 준다.
    const result = heroBannerSchema.safeParse({ ...IMAGE_BANNER, endsAt: '2026-09-07T10:00' })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['endsAt'])
  })

  it('should treat an empty period as no limit', () => {
    const parsed = heroBannerSchema.parse({ ...IMAGE_BANNER, startsAt: '', endsAt: '' })

    expect(parsed.startsAt).toBeNull()
    expect(parsed.endsAt).toBeNull()
  })

  it('should reject a non numeric sort order', () => {
    expect(heroBannerSchema.safeParse({ ...IMAGE_BANNER, sortOrder: '첫번째' }).success).toBe(false)
  })
})

describe('toHeroBannerRow', () => {
  it('should map an image banner to snake_case columns', () => {
    expect(toHeroBannerRow(heroBannerSchema.parse(IMAGE_BANNER))).toEqual({
      title: '오픈 안내',
      subtitle: null,
      media_type: 'image',
      image_url: '/images/banner.png',
      video_url: null,
      link_url: '/news',
      cta_label: '자세히',
      sort_order: 0,
      is_active: true,
      starts_at: '2026-09-08T01:00:00.000Z',
      ends_at: '2026-09-09T01:00:00.000Z',
    })
  })

  it('should map a youtube banner with an empty poster to null', () => {
    // DB 의 hero_banners_media_shape 제약이 요구하는 모양 그대로여야 한다.
    expect(toHeroBannerRow(heroBannerSchema.parse(VIDEO_BANNER))).toMatchObject({
      media_type: 'youtube',
      image_url: null,
      video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    })
  })
})

describe('movedOrder', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('should move an item up', () => {
    expect(movedOrder(items, 'b', 'up')?.map((item) => item.id)).toEqual(['b', 'a', 'c'])
  })

  it('should move an item down', () => {
    expect(movedOrder(items, 'b', 'down')?.map((item) => item.id)).toEqual(['a', 'c', 'b'])
  })

  it('should refuse to move past either end', () => {
    expect(movedOrder(items, 'a', 'up')).toBeNull()
    expect(movedOrder(items, 'c', 'down')).toBeNull()
  })

  it('should return null for an unknown id', () => {
    expect(movedOrder(items, 'zzz', 'up')).toBeNull()
  })
})
