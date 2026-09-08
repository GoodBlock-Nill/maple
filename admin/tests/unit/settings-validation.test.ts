import { describe, expect, it } from 'vitest'

import {
  heroBannerSchema,
  kstDateTimeLocal,
  kstLocalToIso,
  movedOrder,
  siteSettingsSchema,
  toSiteSettingsRow,
} from '@/lib/validation/settings'

const SETTINGS = {
  gameName: '글자월드',
  worldId: 'world-1',
  discordUrl: 'https://discord.gg/abc',
  youtubeUrl: 'https://youtube.com/@abc',
  contactEmail: 'contact@example.com',
  ipNotice: '고지',
  copyright: '© 글자월드',
  creatorName: '세글자',
  creatorSlogan: '슬로건',
  creatorIntro: '첫 문단\n\n둘째 문단',
  creatorPhotoUrl: '/images/about/photo.png',
}

describe('siteSettingsSchema', () => {
  it('should accept a fully filled form', () => {
    expect(siteSettingsSchema.parse(SETTINGS).gameName).toBe('글자월드')
  })

  it('should store empty optional fields as null', () => {
    // 빈 문자열로 저장하면 사용자 사이트의 "값 없음" 폴백이 동작하지 않는다.
    const parsed = siteSettingsSchema.parse({
      ...SETTINGS,
      worldId: '',
      discordUrl: '',
      contactEmail: '',
    })

    expect(parsed).toMatchObject({ worldId: null, discordUrl: null, contactEmail: null })
  })

  it('should require the site name', () => {
    expect(siteSettingsSchema.safeParse({ ...SETTINGS, gameName: '  ' }).success).toBe(false)
  })

  it('should reject a URL without a scheme', () => {
    const result = siteSettingsSchema.safeParse({ ...SETTINGS, discordUrl: 'discord.gg/abc' })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('http(s)')
  })

  it('should reject a malformed email', () => {
    expect(siteSettingsSchema.safeParse({ ...SETTINGS, contactEmail: 'contact@' }).success).toBe(
      false,
    )
  })

  it('should keep paragraph breaks in the creator intro', () => {
    expect(siteSettingsSchema.parse(SETTINGS).creatorIntro).toBe('첫 문단\n\n둘째 문단')
  })

  it('should allow a rooted path for the creator photo but not a bare filename', () => {
    expect(
      siteSettingsSchema.safeParse({ ...SETTINGS, creatorPhotoUrl: 'photo.png' }).success,
    ).toBe(false)
    expect(
      siteSettingsSchema.parse({ ...SETTINGS, creatorPhotoUrl: '/a.png' }).creatorPhotoUrl,
    ).toBe('/a.png')
  })

  it('should map to snake_case columns', () => {
    expect(toSiteSettingsRow(siteSettingsSchema.parse(SETTINGS))).toMatchObject({
      game_name: '글자월드',
      creator_photo_url: '/images/about/photo.png',
    })
  })
})

describe('heroBannerSchema', () => {
  const BANNER = {
    title: '오픈 안내',
    subtitle: '',
    imageUrl: '/images/banner.png',
    linkUrl: '/news',
    ctaLabel: '자세히',
    sortOrder: '0',
    isActive: true,
    startsAt: '2026-09-08T10:00',
    endsAt: '2026-09-09T10:00',
  }

  it('should accept a scheduled banner', () => {
    const parsed = heroBannerSchema.parse(BANNER)

    expect(parsed.sortOrder).toBe(0)
    expect(parsed.startsAt).toBe('2026-09-08T01:00:00.000Z')
  })

  it('should require an image', () => {
    expect(heroBannerSchema.safeParse({ ...BANNER, imageUrl: '' }).success).toBe(false)
  })

  it('should reject an end that precedes the start', () => {
    // DB 의 hero_banners_period 제약과 같은 규칙을 화면에서 먼저 알려 준다.
    const result = heroBannerSchema.safeParse({ ...BANNER, endsAt: '2026-09-07T10:00' })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['endsAt'])
  })

  it('should treat an empty period as no limit', () => {
    const parsed = heroBannerSchema.parse({ ...BANNER, startsAt: '', endsAt: '' })

    expect(parsed.startsAt).toBeNull()
    expect(parsed.endsAt).toBeNull()
  })

  it('should reject a non numeric sort order', () => {
    expect(heroBannerSchema.safeParse({ ...BANNER, sortOrder: '첫번째' }).success).toBe(false)
  })
})

describe('kst datetime helpers', () => {
  it('should render an ISO instant as Korean wall clock', () => {
    expect(kstDateTimeLocal('2026-09-08T01:00:00.000Z')).toBe('2026-09-08T10:00')
  })

  it('should read a Korean wall clock back as the same instant', () => {
    expect(kstLocalToIso('2026-09-08T10:00')).toBe('2026-09-08T01:00:00.000Z')
  })

  it('should round-trip', () => {
    const iso = '2026-04-16T10:00:00.000Z'

    expect(kstLocalToIso(kstDateTimeLocal(iso))).toBe(iso)
  })

  it('should pass through an ISO string that arrives from CSV', () => {
    expect(kstLocalToIso('2026-04-16T10:00:00Z')).toBe('2026-04-16T10:00:00.000Z')
  })

  it('should treat empty and unparsable values as no value', () => {
    expect(kstDateTimeLocal(null)).toBe('')
    expect(kstLocalToIso('')).toBeNull()
    expect(kstLocalToIso('어제')).toBeNull()
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
