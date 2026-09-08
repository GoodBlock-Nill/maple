import { notFound } from 'next/navigation'
import { NextResponse } from 'next/server'

import { getSiteSettings } from '@/lib/data/site'
import { resolveSnsDestination } from '@/lib/utils/external-links'

/**
 * `/sns/[name]` → SNS 채널로 302 리다이렉트. `name` 이 youtube/discord/facebook
 * 이 아니면 404.
 *
 * 목적지가 Supabase `site_settings` 에 의존하므로 정적으로 캐시하면 안 된다.
 * 매 요청 재조회한다.
 */
export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: RouteContext<'/sns/[name]'>,
): Promise<NextResponse> {
  const { name } = await params
  const settings = await getSiteSettings()
  const destination = resolveSnsDestination(name, {
    discordUrl: settings?.discordUrl ?? null,
    youtubeUrl: settings?.youtubeUrl ?? null,
  })

  if (destination === null) {
    notFound()
  }

  return NextResponse.redirect(destination, 302)
}
