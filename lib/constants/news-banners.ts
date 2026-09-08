import { DEFAULT_NEWS_CATEGORY, NEWS_CATEGORIES, NEWS_CATEGORY_VALUES } from '@/lib/constants/board'

import type { NewsCategory } from '@/types/domain'

/**
 * 뉴스 말머리별 배너(Figma `공지별 배너_1200x628`, 2032:1882).
 *
 * 파일명은 카테고리 키와 같게 두어(`notice.png` …) 카테고리가 늘어나도
 * 자산·상수 두 곳만 맞추면 되게 했다. 원본은 1200×628 고정이므로 화면에서는
 * 항상 이 비율로 그린다.
 */

export const NEWS_BANNER_WIDTH = 1200

export const NEWS_BANNER_HEIGHT = 628

/** `aspect-[1200/628]` 처럼 Tailwind 임의값으로 쓸 때의 원본 비율 문자열. */
export const NEWS_BANNER_RATIO = `${NEWS_BANNER_WIDTH}/${NEWS_BANNER_HEIGHT}`

const NEWS_BANNER_DIR = '/images/news/banners'

export type NewsBanner = {
  src: string
  /** 배너 안 글자가 곧 말머리라 라벨을 그대로 대체 텍스트로 쓴다. */
  alt: string
  width: number
  height: number
}

function toBanner(category: NewsCategory, label: string): NewsBanner {
  return {
    src: `${NEWS_BANNER_DIR}/${category}.png`,
    alt: `${label} 배너`,
    width: NEWS_BANNER_WIDTH,
    height: NEWS_BANNER_HEIGHT,
  }
}

/** 카테고리 → 배너. `NEWS_CATEGORIES` 에서 파생하므로 누락이 생길 수 없다. */
export const NEWS_BANNERS: Record<NewsCategory, NewsBanner> = Object.fromEntries(
  NEWS_CATEGORIES.map((category) => [category.value, toBanner(category.value, category.label)]),
) as Record<NewsCategory, NewsBanner>

/**
 * DB 에 남아 있을 수 있는 옛 말머리(FK 로만 강제되고 타입은 text 다)가 와도
 * 배너가 비지 않도록 기본 카테고리(공지사항) 배너로 떨어뜨린다.
 */
export function getNewsBanner(category: string): NewsBanner {
  const known = NEWS_CATEGORY_VALUES.find((value) => value === category) ?? DEFAULT_NEWS_CATEGORY

  return NEWS_BANNERS[known]
}
