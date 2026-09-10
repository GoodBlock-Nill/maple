import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HeroMediaFrame } from '@/components/about/HeroMediaFrame'
import { resolveAboutHeroMedia } from '@/components/about/hero-media'

import type { HeroBanner } from '@/types/domain'

/**
 * 소개 페이지 상단은 관리자 입력 조합(배너 유형 · 빈 URL · 채널 URL)에 따라
 * 갈린다. 특히 **아무 미디어도 없을 때 아무것도 그리지 않는 것**이 계약이다 —
 * 예전에는 로컬 스틸과 재생 버튼이 남아 "없는 영상"이 있는 것처럼 보였다
 * (오너 요청 2026-09-10).
 */

const CHANNEL_URL = 'https://www.youtube.com/@세글자'
const VIDEO_URL = 'https://www.youtube.com/watch?v=abc123XYZ_-'
const DEFAULT_TITLE = '세글자 크리에이터 소개 영상'

function banner(overrides: Partial<HeroBanner>): HeroBanner {
  return {
    id: 'banner-1',
    title: '배너',
    subtitle: null,
    mediaType: 'image',
    imageUrl: null,
    youtubeId: null,
    linkUrl: null,
    ctaLabel: null,
    ...overrides,
  }
}

describe('resolveAboutHeroMedia', () => {
  it('should return null when there is neither a banner nor a video url', () => {
    expect(resolveAboutHeroMedia(null, '', DEFAULT_TITLE)).toBeNull()
  })

  it('should return null when the site video url has no extractable video id', () => {
    expect(resolveAboutHeroMedia(null, CHANNEL_URL, DEFAULT_TITLE)).toBeNull()
  })

  it('should fall back to the site video url when no banner is active', () => {
    expect(resolveAboutHeroMedia(null, VIDEO_URL, DEFAULT_TITLE)).toEqual({
      kind: 'youtube',
      videoId: 'abc123XYZ_-',
      thumbnail: 'https://i.ytimg.com/vi/abc123XYZ_-/maxresdefault.jpg',
      title: DEFAULT_TITLE,
      isExternalThumbnail: false,
    })
  })

  it('should prefer an active image banner over the site video url', () => {
    const media = resolveAboutHeroMedia(
      banner({ mediaType: 'image', imageUrl: '/images/hero.png', title: '공지', linkUrl: '/news' }),
      VIDEO_URL,
      DEFAULT_TITLE,
    )

    expect(media).toEqual({ kind: 'image', src: '/images/hero.png', alt: '공지', href: '/news' })
  })

  it('should use the youtube thumbnail when a youtube banner has no image of its own', () => {
    const media = resolveAboutHeroMedia(
      banner({ mediaType: 'youtube', youtubeId: 'zzz111YYY', title: '신규 영상' }),
      VIDEO_URL,
      DEFAULT_TITLE,
    )

    expect(media).toEqual({
      kind: 'youtube',
      videoId: 'zzz111YYY',
      thumbnail: 'https://i.ytimg.com/vi/zzz111YYY/maxresdefault.jpg',
      title: '신규 영상',
      isExternalThumbnail: false,
    })
  })

  it('should mark a storage-hosted banner thumbnail as external', () => {
    const media = resolveAboutHeroMedia(
      banner({
        mediaType: 'youtube',
        youtubeId: 'zzz111YYY',
        imageUrl: 'https://example.supabase.co/storage/v1/object/public/a.png',
      }),
      '',
      DEFAULT_TITLE,
    )

    expect(media).toMatchObject({ isExternalThumbnail: true })
  })

  /** 배너가 그릴 수 없는 상태(이미지 배너인데 이미지가 없다)면 영상 폴백으로 내려간다. */
  it('should ignore an image banner without an image', () => {
    expect(resolveAboutHeroMedia(banner({ mediaType: 'image' }), '', DEFAULT_TITLE)).toBeNull()
  })
})

describe('HeroMediaFrame 미디어 없음', () => {
  it('should keep the design hero backdrop and drop the media box entirely', () => {
    const { container } = render(<HeroMediaFrame />)
    const images = [...container.querySelectorAll('img')]

    /* 시안의 히어로 배경 한 장만 남는다 — 폴백 썸네일·재생 버튼·빈 상자는 없다. */
    expect(images).toHaveLength(1)
    expect(images[0]?.getAttribute('src')).toContain('video-still.png')
    expect(container.querySelector('.bg-black')).toBeNull()
    expect(container.querySelector('button')).toBeNull()
    expect(container.querySelector('iframe')).toBeNull()
  })

  it('should keep the design hero height so the characters stay in place', () => {
    const { container } = render(<HeroMediaFrame />)
    const frame = container.firstElementChild

    /* 캐릭터·나무 단상은 씬 상단 절대 배치라 이 높이가 사라지면 밴드가 올라와 겹친다. */
    expect(frame?.className).toContain('h-[calc(var(--hero-w,1440px)*0.5298611)]')
    expect(frame?.className).not.toContain('pt-[112px]')
  })

  it('should draw the box only when media is given', () => {
    const { container } = render(
      <HeroMediaFrame>
        <span>media</span>
      </HeroMediaFrame>,
    )

    expect(container.querySelector('.bg-black')).not.toBeNull()
    expect(container.textContent).toBe('media')
  })
})
