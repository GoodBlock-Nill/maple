import { NextResponse } from 'next/server'

import { getSiteSettings } from '@/lib/data/site'
import { resolveDiscordDestination } from '@/lib/utils/external-links'

/**
 * `/discord` → 디스코드 서버 초대 링크로 302 리다이렉트.
 *
 * 목적지가 `site_settings.discord_url`(Supabase) 에 의존하므로 정적으로 캐시하면
 * 안 된다. 매 요청 재조회한다.
 */
export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const settings = await getSiteSettings()
  const destination = resolveDiscordDestination(settings?.discordUrl ?? null)

  return NextResponse.redirect(destination, 302)
}
