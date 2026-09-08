import { NextResponse } from 'next/server'

import { getSiteSettings } from '@/lib/data/site'
import { resolvePlayDestination } from '@/lib/utils/external-links'

/**
 * `/play` → 메이플스토리 월드 플레이 페이지로 302 리다이렉트.
 *
 * 목적지가 `site_settings.world_id`(Supabase) 에 의존하므로 정적으로 캐시하면
 * 안 된다. 매 요청 재조회한다.
 */
export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const settings = await getSiteSettings()
  const destination = resolvePlayDestination(settings?.worldId ?? null)

  return NextResponse.redirect(destination, 302)
}
