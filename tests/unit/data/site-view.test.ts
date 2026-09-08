import { describe, expect, it } from 'vitest'

import { CONTACT_EMAIL, CONTACT_EMAIL_HREF, COPYRIGHT, IP_NOTICE } from '@/lib/constants/site'
import {
  resolveAboutVideoUrl,
  resolveContactEmail,
  resolveCopyright,
  resolveCreator,
  resolveGameName,
  resolveIpNotice,
} from '@/lib/data/site-view'
import { CREATOR_INTRO, CREATOR_NAME, CREATOR_SLOGAN } from '@/lib/mock/site'

import type { SiteSettings } from '@/types/domain'

/** 모든 칸이 비어 있는 설정 행 — 관리자가 아직 아무것도 채우지 않은 상태. */
const EMPTY: SiteSettings = {
  gameName: '글자월드',
  worldId: null,
  discordUrl: null,
  youtubeUrl: null,
  contactEmail: null,
  ipNotice: null,
  copyright: null,
  creatorName: null,
  creatorSlogan: null,
  creatorIntro: null,
  creatorPhotoUrl: null,
}

describe('resolveContactEmail', () => {
  it('should fall back to the constant when the DB value is null', () => {
    expect(resolveContactEmail(null)).toEqual({
      display: CONTACT_EMAIL,
      href: `mailto:${CONTACT_EMAIL_HREF}`,
    })
    expect(resolveContactEmail(EMPTY).display).toBe(CONTACT_EMAIL)
  })

  it('should fall back when the DB value is whitespace only', () => {
    expect(resolveContactEmail({ ...EMPTY, contactEmail: '   ' }).display).toBe(CONTACT_EMAIL)
  })

  it('should show the Korean IDN even when the DB stores punycode', () => {
    // 지금 DB 에 들어 있는 값이 정확히 이 형태다 — 푸터 표기가 바뀌면 안 된다.
    const view = resolveContactEmail({ ...EMPTY, contactEmail: CONTACT_EMAIL_HREF })

    expect(view.display).toBe(CONTACT_EMAIL)
    expect(view.href).toBe(`mailto:${CONTACT_EMAIL_HREF}`)
  })

  it('should use the DB value when it is set', () => {
    expect(resolveContactEmail({ ...EMPTY, contactEmail: 'help@example.com' })).toEqual({
      display: 'help@example.com',
      href: 'mailto:help@example.com',
    })
  })
})

describe('resolveCopyright', () => {
  it('should fall back to the design copy when the DB value is empty', () => {
    expect(resolveCopyright(null)).toBe(COPYRIGHT)
    expect(resolveCopyright({ ...EMPTY, copyright: '' })).toBe(COPYRIGHT)
  })

  it('should use the DB sentence verbatim when it is set', () => {
    expect(resolveCopyright({ ...EMPTY, copyright: '© 2026 글자월드. All rights reserved.' })).toBe(
      '© 2026 글자월드. All rights reserved.',
    )
  })
})

describe('resolveIpNotice', () => {
  it('should fall back to the constant when the DB value is null', () => {
    expect(resolveIpNotice(null)).toBe(IP_NOTICE)
  })

  it('should use the DB notice when it is set', () => {
    expect(resolveIpNotice({ ...EMPTY, ipNotice: '고지 문구' })).toBe('고지 문구')
  })
})

describe('resolveGameName', () => {
  it('should use the DB name and fall back to the constant', () => {
    expect(resolveGameName({ ...EMPTY, gameName: '다른월드' })).toBe('다른월드')
    expect(resolveGameName(null)).toBe('글자월드')
  })
})

describe('resolveCreator', () => {
  it('should fall back to every creator constant when the row is empty', () => {
    const creator = resolveCreator(EMPTY)

    expect(creator.name).toBe(CREATOR_NAME)
    expect(creator.slogan).toBe(CREATOR_SLOGAN)
    expect(creator.intro).toEqual(CREATOR_INTRO)
    expect(creator.photoUrl).toBeNull()
  })

  it('should fall back when settings could not be read at all', () => {
    expect(resolveCreator(null).intro).toEqual(CREATOR_INTRO)
  })

  it('should split the DB intro on blank lines, keeping in-paragraph breaks', () => {
    const creator = resolveCreator({
      ...EMPTY,
      creatorIntro: '첫 문단 앞줄\r\n첫 문단 뒷줄\r\n\r\n둘째 문단',
    })

    expect(creator.intro).toEqual(['첫 문단 앞줄\n첫 문단 뒷줄', '둘째 문단'])
  })

  it('should treat a whitespace-only photo URL as absent', () => {
    expect(resolveCreator({ ...EMPTY, creatorPhotoUrl: '  ' }).photoUrl).toBeNull()
  })

  it('should pass through a stored photo URL', () => {
    const url = 'https://example.supabase.co/storage/v1/object/public/public-assets/creator.png'

    expect(resolveCreator({ ...EMPTY, creatorPhotoUrl: url }).photoUrl).toBe(url)
  })
})

describe('resolveAboutVideoUrl', () => {
  it('should return an empty string when youtube_url is unset, keeping the poster fallback', () => {
    expect(resolveAboutVideoUrl(null)).toBe('')
    expect(resolveAboutVideoUrl(EMPTY)).toBe('')
  })

  it('should reuse the same field the footer /sns/youtube link uses', () => {
    expect(resolveAboutVideoUrl({ ...EMPTY, youtubeUrl: 'https://youtu.be/abc123xyz' })).toBe(
      'https://youtu.be/abc123xyz',
    )
  })
})
