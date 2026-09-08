import { existsSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { NEWS_CATEGORIES, NEWS_CATEGORY_VALUES } from '@/lib/constants/board'
import {
  getNewsBanner,
  NEWS_BANNER_HEIGHT,
  NEWS_BANNER_RATIO,
  NEWS_BANNER_WIDTH,
  NEWS_BANNERS,
} from '@/lib/constants/news-banners'

describe('news banner map', () => {
  it('should cover every news category when the map is built', () => {
    // Arrange & Act
    const keys = Object.keys(NEWS_BANNERS)

    // Assert
    expect(keys).toEqual([...NEWS_CATEGORY_VALUES])
    expect(keys).toHaveLength(6)
  })

  it('should point at the category png when looked up', () => {
    // Arrange & Act
    const sources = NEWS_CATEGORY_VALUES.map((value) => NEWS_BANNERS[value].src)

    // Assert
    expect(sources).toEqual([
      '/images/news/banners/notice.png',
      '/images/news/banners/maintenance.png',
      '/images/news/banners/update.png',
      '/images/news/banners/patch.png',
      '/images/news/banners/event.png',
      '/images/news/banners/info.png',
    ])
  })

  it('should label the alt text with the category label when resolved', () => {
    // Arrange & Act
    const alts = NEWS_CATEGORIES.map((category) => NEWS_BANNERS[category.value].alt)

    // Assert
    expect(alts).toEqual(NEWS_CATEGORIES.map((category) => `${category.label} 배너`))
  })

  it('should keep the 1200x628 source size when rendered', () => {
    // Arrange & Act
    const sizes = Object.values(NEWS_BANNERS).map((banner) => [banner.width, banner.height])

    // Assert
    expect(sizes.every(([width, height]) => width === 1200 && height === 628)).toBe(true)
    expect(NEWS_BANNER_WIDTH).toBe(1200)
    expect(NEWS_BANNER_HEIGHT).toBe(628)
    expect(NEWS_BANNER_RATIO).toBe('1200/628')
  })

  it('should ship every banner file when the map is resolved', () => {
    // Arrange & Act — 매핑만 맞고 파일이 없으면 상세에서 깨진 이미지가 남는다.
    const missing = Object.values(NEWS_BANNERS)
      .map((banner) => banner.src)
      .filter((src) => !existsSync(path.join(process.cwd(), 'public', src)))

    // Assert
    expect(missing).toEqual([])
  })
})

describe('getNewsBanner', () => {
  it('should return the matching banner when the category is known', () => {
    // Arrange & Act
    const banner = getNewsBanner('maintenance')

    // Assert
    expect(banner.src).toBe('/images/news/banners/maintenance.png')
    expect(banner.alt).toBe('점검안내 배너')
  })

  it('should fall back to the notice banner when the category is unknown', () => {
    // Arrange & Act — DB 의 category_key 는 text 라 옛 말머리가 남아 있을 수 있다.
    const legacy = getNewsBanner('legacy-key')
    const empty = getNewsBanner('')

    // Assert
    expect(legacy.src).toBe('/images/news/banners/notice.png')
    expect(empty.src).toBe('/images/news/banners/notice.png')
  })
})
