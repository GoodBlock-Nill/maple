import { unstable_cache } from 'next/cache'

import { CACHE_TAGS, STATIC_REVALIDATE_SECONDS } from '@/lib/data/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { extractYoutubeId } from '@/lib/utils/youtube'

import type { Tables } from '@/types/database.types'
import type { HeroBanner } from '@/types/domain'

/**
 * 홈 히어로 배너 접근 계층 (`hero_banners`).
 *
 * 관리자가 등록한 배너 중 **한 장**만 노출한다 — 히어로의 빈 띠(CTA 아래 ·
 * 구름 위 · 소년과 버섯 사이)는 카드 하나가 들어갈 크기라 슬라이더를 두지 않는다.
 * 선택 규칙은 `pickActiveHeroBanner` 에 순수 함수로 두어 테스트한다.
 *
 * 캐시는 `site` 태그 하나로 사이트 설정과 함께 비워진다(관리자 저장 시
 * `POST /api/revalidate`). 기간(starts_at · ends_at) 판정은 캐시 시점 기준이라
 * 최대 `STATIC_REVALIDATE_SECONDS` 만큼 늦게 바뀔 수 있다.
 */

type HeroBannerRow = Tables<'hero_banners'>

export function toHeroBanner(row: HeroBannerRow): HeroBanner {
  const isYoutube = row.media_type === 'youtube'
  const youtubeId = isYoutube && row.video_url !== null ? extractYoutubeId(row.video_url) : null

  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    mediaType: isYoutube ? 'youtube' : 'image',
    imageUrl: row.image_url,
    youtubeId,
    linkUrl: row.link_url,
    ctaLabel: row.cta_label,
  }
}

function isWithinPeriod(row: HeroBannerRow, now: Date): boolean {
  const time = now.getTime()

  if (row.starts_at !== null && new Date(row.starts_at).getTime() > time) return false
  if (row.ends_at !== null && new Date(row.ends_at).getTime() <= time) return false

  return true
}

/** 영상 id 를 못 뽑은 유튜브 배너는 그릴 수 없으므로 건너뛴다. */
function isRenderable(banner: HeroBanner): boolean {
  return banner.mediaType === 'youtube' ? banner.youtubeId !== null : banner.imageUrl !== null
}

/**
 * 노출 중인 배너 중 첫 장. 입력은 이미 `sort_order, created_at` 순으로 정렬돼
 * 있어야 한다(쿼리가 보장). `is_active` 는 RLS 정책이 걸러 주지만 여기서도 본다.
 */
export function pickActiveHeroBanner(rows: readonly HeroBannerRow[], now: Date): HeroBanner | null {
  for (const row of rows) {
    if (!row.is_active || !isWithinPeriod(row, now)) continue

    const banner = toHeroBanner(row)

    if (isRenderable(banner)) return banner
  }

  return null
}

async function fetchActiveHeroBanner(): Promise<HeroBanner | null> {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('hero_banners')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error !== null || data === null) {
    return null
  }

  return pickActiveHeroBanner(data, new Date())
}

const getCachedHeroBanner = unstable_cache(fetchActiveHeroBanner, ['hero-banner'], {
  tags: [CACHE_TAGS.site],
  revalidate: STATIC_REVALIDATE_SECONDS,
})

export async function getActiveHeroBanner(): Promise<HeroBanner | null> {
  return getCachedHeroBanner()
}
