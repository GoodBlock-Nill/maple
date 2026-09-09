import { describe, expect, it } from 'vitest'

import { parseYoutubeId, youtubeThumbnailUrl } from '@/lib/utils/youtube'

const ID = 'dQw4w9WgXcQ'

describe('parseYoutubeId', () => {
  it.each([
    ['watch', `https://www.youtube.com/watch?v=${ID}`],
    ['watch with extra params', `https://www.youtube.com/watch?v=${ID}&list=PL123&t=30s`],
    ['mobile watch', `https://m.youtube.com/watch?v=${ID}`],
    ['short link', `https://youtu.be/${ID}`],
    ['short link with time', `https://youtu.be/${ID}?t=42`],
    ['shorts', `https://www.youtube.com/shorts/${ID}`],
    ['embed', `https://www.youtube.com/embed/${ID}`],
    ['nocookie embed', `https://www.youtube-nocookie.com/embed/${ID}?rel=0`],
    ['live', `https://www.youtube.com/live/${ID}`],
    ['bare host', `https://youtube.com/watch?v=${ID}`],
    ['surrounding spaces', `  https://youtu.be/${ID}  `],
  ])('should read the id from a %s url', (_label, url) => {
    expect(parseYoutubeId(url)).toBe(ID)
  })

  it.each([
    ['empty', ''],
    ['not a url', '그냥 문구'],
    ['channel page', 'https://www.youtube.com/@gjworld'],
    ['playlist only', 'https://www.youtube.com/playlist?list=PL1234567890'],
    ['another site with a v param', `https://evil.example/?v=${ID}`],
    ['vimeo', 'https://vimeo.com/123456789'],
    ['too short id', 'https://youtu.be/abc'],
    ['javascript scheme', `javascript:alert(1)//youtu.be/${ID}`],
  ])('should return null for a %s value', (_label, url) => {
    expect(parseYoutubeId(url)).toBeNull()
  })
})

describe('youtubeThumbnailUrl', () => {
  it('should point at the always-present hqdefault image', () => {
    // maxresdefault 는 원본이 저화질이면 404 라 목록의 칸이 비어 버린다.
    expect(youtubeThumbnailUrl(ID)).toBe(`https://img.youtube.com/vi/${ID}/hqdefault.jpg`)
  })
})
