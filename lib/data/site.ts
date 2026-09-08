import { unstable_cache } from 'next/cache'

import { CACHE_TAGS, STATIC_REVALIDATE_SECONDS } from '@/lib/data/cache'
import { toSiteSettings } from '@/lib/data/mappers'
import { createPublicClient } from '@/lib/supabase/public'

import type { SiteSettings } from '@/types/domain'

/**
 * 사이트 전역 설정 접근 계층 (`site_settings` 단일 행, id = 1).
 *
 * 관리자에서 갱신되면 `revalidateTag(CACHE_TAGS.site)` 로 즉시 무효화한다.
 * 행이 없거나 읽기에 실패하면 null 을 돌려주고, 호출부는 `lib/constants/site.ts`
 * 의 정적 기본값으로 폴백한다 — 설정 한 줄 때문에 페이지가 죽으면 안 된다.
 */
const SETTINGS_ID = 1

async function fetchSiteSettings(): Promise<SiteSettings | null> {
  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('site_settings')
    .select('*')
    .eq('id', SETTINGS_ID)
    .maybeSingle()

  if (error !== null || data === null) {
    return null
  }

  return toSiteSettings(data)
}

const getCachedSiteSettings = unstable_cache(fetchSiteSettings, ['site-settings'], {
  tags: [CACHE_TAGS.site],
  revalidate: STATIC_REVALIDATE_SECONDS,
})

export async function getSiteSettings(): Promise<SiteSettings | null> {
  return getCachedSiteSettings()
}
