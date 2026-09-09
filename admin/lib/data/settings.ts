import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { parseYoutubeId } from '@/lib/utils/youtube'

import type { HeroMediaType } from '@/lib/validation/hero-banner'

/**
 * 사이트 설정 · 히어로 배너 조회.
 *
 * `site_settings` 는 id = 1 단일 행이다(체크 제약으로 2행째가 막혀 있다).
 * 배너는 사용자 사이트와 달리 **예약·종료된 것까지 전부** 보여야 한다 —
 * `hero_banners_admin_all` 정책이 관리자에게 전체를 열어 준다.
 */

export const SITE_SETTINGS_ID = 1

export type SiteSettingsRecord = {
  gameName: string
  worldId: string | null
  discordUrl: string | null
  youtubeUrl: string | null
  contactEmail: string | null
  ipNotice: string | null
  copyright: string | null
  creatorName: string | null
  creatorSlogan: string | null
  creatorIntro: string | null
  creatorPhotoUrl: string | null
  updatedAt: string
}

export type HeroBannerRecord = {
  id: string
  title: string
  subtitle: string | null
  mediaType: HeroMediaType
  /** 이미지 배너의 그림. 영상 배너에서는 포스터(대체 이미지)라 비어 있을 수 있다. */
  imageUrl: string | null
  videoUrl: string | null
  /** `videoUrl` 에서 뽑은 영상 id. 알아볼 수 없는 주소면 null 이라 썸네일을 접는다. */
  youtubeId: string | null
  linkUrl: string | null
  ctaLabel: string | null
  sortOrder: number
  isActive: boolean
  startsAt: string | null
  endsAt: string | null
  updatedAt: string
}

export async function getSiteSettings(): Promise<SiteSettingsRecord | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('site_settings')
    .select('*')
    .eq('id', SITE_SETTINGS_ID)
    .maybeSingle()

  if (error !== null || data === null) {
    if (error !== null) {
      console.error('[settings] 조회 실패', error.message)
    }

    return null
  }

  return {
    gameName: data.game_name,
    worldId: data.world_id,
    discordUrl: data.discord_url,
    youtubeUrl: data.youtube_url,
    contactEmail: data.contact_email,
    ipNotice: data.ip_notice,
    copyright: data.copyright,
    creatorName: data.creator_name,
    creatorSlogan: data.creator_slogan,
    creatorIntro: data.creator_intro,
    creatorPhotoUrl: data.creator_photo_url,
    updatedAt: data.updated_at,
  }
}

/** 노출 순서 그대로. 정렬값이 같으면 만든 순으로 고정해 목록이 흔들리지 않게 한다. */
export async function getHeroBanners(): Promise<readonly HeroBannerRecord[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('hero_banners')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error !== null) {
    console.error('[settings] 배너 조회 실패', error.message)

    return []
  }

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    /* media_type 은 text + 체크 제약이라 타입 생성기가 string 으로 내려 준다.
       제약 밖의 값이 들어올 길은 없지만, 화면이 분기하는 값이라 좁혀서 받는다. */
    mediaType: row.media_type === 'youtube' ? 'youtube' : 'image',
    imageUrl: row.image_url,
    videoUrl: row.video_url,
    youtubeId: row.video_url === null ? null : parseYoutubeId(row.video_url),
    linkUrl: row.link_url,
    ctaLabel: row.cta_label,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    updatedAt: row.updated_at,
  }))
}
