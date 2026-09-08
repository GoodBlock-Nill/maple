import {
  COMMUNITY_CATEGORY_VALUES,
  DEFAULT_COMMUNITY_CATEGORY,
  DEFAULT_NEWS_CATEGORY,
  NEWS_CATEGORY_VALUES,
} from '@/lib/constants/board'
import { DEFAULT_GACHA_TAB, GACHA_TAB_VALUES } from '@/lib/constants/guide'

import type {
  CommentRow,
  FaqRow,
  GachaItemRow,
  PostRow,
  RankingRow,
  SiteSettings as SiteSettingsRow,
} from '@/lib/supabase/types'
import type {
  Comment,
  CommunityCategory,
  FaqItem,
  GachaGrade,
  GachaItem,
  GachaRow as GachaTableRow,
  NewsCategory,
  NewsItem,
  Post,
  RankingEntry,
  SiteSettings,
} from '@/types/domain'

/**
 * DB 행 → 도메인 타입 변환.
 *
 * DB 는 snake_case + nullable, 화면은 camelCase + non-null 을 기대한다. 이 경계를
 * 한 파일에 몰아 두면 스키마가 흔들려도 수정 지점이 여기로 한정된다.
 *
 * 카테고리·탭은 DB enum/FK 로 이미 강제되지만, `gen types` 가 `category_key` 를
 * 평범한 text 로 내보내기 때문에 런타임에서 한 번 더 좁힌다. 알 수 없는 값이
 * 와도 화면이 죽지 않도록 기본값으로 떨어뜨린다.
 */

const GACHA_GRADES: readonly GachaGrade[] = ['SS', 'S', 'A', 'B', 'C']

/**
 * 목록 쿼리는 `select('*')` 대신 필요한 컬럼만 읽는다. 매퍼도 그 부분집합만
 * 요구해야 컬럼이 늘어날 때 매퍼가 따라 흔들리지 않는다.
 */
export type NewsSource = Pick<
  PostRow,
  | 'id'
  | 'category_key'
  | 'title'
  | 'summary'
  | 'content'
  | 'thumbnail_url'
  | 'view_count'
  | 'published_at'
>

export type PostSource = Pick<
  PostRow,
  | 'id'
  | 'category_key'
  | 'title'
  | 'content'
  | 'author_name'
  | 'view_count'
  | 'like_count'
  | 'comment_count'
  | 'created_at'
>

export type CommentSource = Pick<CommentRow, 'id' | 'author_name' | 'content' | 'created_at'>

function toNewsCategory(key: string): NewsCategory {
  return NEWS_CATEGORY_VALUES.find((value) => value === key) ?? DEFAULT_NEWS_CATEGORY
}

function toCommunityCategory(key: string): CommunityCategory {
  return COMMUNITY_CATEGORY_VALUES.find((value) => value === key) ?? DEFAULT_COMMUNITY_CATEGORY
}

export function toNewsItem(row: NewsSource): NewsItem {
  return {
    id: row.id,
    category: toNewsCategory(row.category_key),
    title: row.title,
    summary: row.summary ?? '',
    body: row.content,
    views: row.view_count,
    publishedAt: row.published_at,
    ...(row.thumbnail_url === null ? {} : { thumbnail: row.thumbnail_url }),
  }
}

export function toComment(row: CommentSource): Comment {
  return {
    id: row.id,
    author: row.author_name,
    body: row.content,
    createdAt: row.created_at,
  }
}

export function toPost(row: PostSource, comments: readonly Comment[] = []): Post {
  return {
    id: row.id,
    category: toCommunityCategory(row.category_key),
    title: row.title,
    body: row.content,
    author: row.author_name,
    views: row.view_count,
    likes: row.like_count,
    createdAt: row.created_at,
    commentCount: row.comment_count,
    comments,
  }
}

/** 카드의 대표 확률. 소수 둘째 자리 문자열로 고정해 표기 흔들림을 막는다. */
function toProbabilityText(value: number): string {
  return value.toFixed(2)
}

function isGachaTableRow(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key]

  return typeof value === 'string' ? value : ''
}

/** `gacha_items.rows` 는 jsonb 라 타입 보장이 없다. 한 행씩 좁혀서 담는다. */
function toGachaTableRows(value: unknown): readonly GachaTableRow[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isGachaTableRow).map((row) => ({
    grade: GACHA_GRADES.find((grade) => grade === row.grade) ?? 'C',
    itemName: readString(row, 'itemName'),
    itemIcon: readString(row, 'itemIcon'),
    probability: readString(row, 'probability'),
    note: readString(row, 'note'),
  }))
}

/** 아이콘이 비어 있으면 카드가 깨진 이미지를 그리므로 첫 확률표 행의 아이콘을 빌린다. */
const GACHA_FALLBACK_ICON = '/images/guide/icon-item-1.png'

export function toGachaItem(row: GachaItemRow): GachaItem {
  const rows = toGachaTableRows(row.rows)

  return {
    id: row.id,
    tab: GACHA_TAB_VALUES.find((tab) => tab === row.tab) ?? DEFAULT_GACHA_TAB,
    name: row.name,
    icon: row.icon_url ?? rows[0]?.itemIcon ?? GACHA_FALLBACK_ICON,
    probability: toProbabilityText(row.probability),
    updatedAt: row.published_at,
    rows,
  }
}

export function toRankingEntry(row: RankingRow): RankingEntry {
  return {
    id: row.id,
    nickname: row.character_name,
    level: row.level,
    job: row.job,
    jobGroup: row.job_group,
    exp: row.exp ?? '-',
    guild: row.guild,
    ...(row.avatar_url === null ? {} : { character: row.avatar_url }),
  }
}

export function toFaqItem(row: FaqRow): FaqItem {
  return {
    id: row.id,
    category: row.category,
    question: row.question,
    answer: row.answer,
  }
}

export function toSiteSettings(row: SiteSettingsRow): SiteSettings {
  return {
    gameName: row.game_name,
    worldId: row.world_id,
    discordUrl: row.discord_url,
    youtubeUrl: row.youtube_url,
    contactEmail: row.contact_email,
    ipNotice: row.ip_notice,
    copyright: row.copyright,
    creatorName: row.creator_name,
    creatorSlogan: row.creator_slogan,
    creatorIntro: row.creator_intro,
    creatorPhotoUrl: row.creator_photo_url,
  }
}
