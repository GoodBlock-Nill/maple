/**
 * 뉴스 모듈의 도메인 상수 — 말머리 6종과 운영 상태 판정.
 *
 * 말머리 키는 `board_categories`(board = 'news')의 `key` 와 1:1 이다. DB 에서
 * 매번 읽어 오지 않고 여기 고정해 두는 이유는 두 가지다.
 *  1) 목록 필터·뱃지·폼 select 가 서버 왕복 없이 같은 목록을 쓴다.
 *  2) 저장 전 검증(zod enum)이 DB 조회 없이도 허용 목록을 강제한다 —
 *     FK(`posts_category_fkey`)가 최종 방어선이므로 둘이 어긋나면 저장이 실패한다.
 *
 * 라벨을 바꾸려면 마이그레이션(`20260908001600_news_categories`)과 함께 고친다.
 */

import type { BadgeTone } from '@/components/ui/Badge'

export const NEWS_BOARD = 'news'

/** 칩 노출 순서 = 마이그레이션의 `sort_order`. 배열 순서를 그대로 화면이 쓴다. */
export const NEWS_CATEGORY_KEYS = [
  'notice',
  'maintenance',
  'update',
  'patch',
  'event',
  'info',
] as const

export type NewsCategoryKey = (typeof NEWS_CATEGORY_KEYS)[number]

const CATEGORY_LABEL: Record<NewsCategoryKey, string> = {
  notice: '공지사항',
  maintenance: '점검안내',
  update: '업데이트 안내',
  patch: '패치노트',
  event: '이벤트',
  info: '안내사항',
}

/* 톤은 리터럴 매핑이어야 한다 — Tailwind 는 소스를 정적으로 훑으므로
   `bg-${tone}` 처럼 조립한 클래스는 생성되지 않는다(Badge 주석 참고). */
const CATEGORY_TONE: Record<NewsCategoryKey, BadgeTone> = {
  notice: 'accent',
  maintenance: 'warn',
  update: 'success',
  patch: 'neutral',
  event: 'accent',
  info: 'neutral',
}

export type NewsCategory = {
  key: NewsCategoryKey
  label: string
  tone: BadgeTone
}

export const NEWS_CATEGORIES: readonly NewsCategory[] = NEWS_CATEGORY_KEYS.map((key) => ({
  key,
  label: CATEGORY_LABEL[key],
  tone: CATEGORY_TONE[key],
}))

export function isNewsCategoryKey(value: string): value is NewsCategoryKey {
  return (NEWS_CATEGORY_KEYS as readonly string[]).includes(value)
}

/** 알 수 없는 키(마이그레이션 이전 글)도 목록을 깨뜨리지 않고 그대로 보여 준다. */
export function newsCategoryLabel(key: string): string {
  return isNewsCategoryKey(key) ? CATEGORY_LABEL[key] : key
}

export function newsCategoryTone(key: string): BadgeTone {
  return isNewsCategoryKey(key) ? CATEGORY_TONE[key] : 'neutral'
}

/* 입력 상한. DB 에는 길이 제약이 없으므로(스키마 확인) 여기가 유일한 기준이다. */
export const NEWS_TITLE_MAX = 100
export const NEWS_SUMMARY_MAX = 200

/* ---------------------------------------------------------------------------
 * 상태
 * ------------------------------------------------------------------------ */

export const NEWS_STATUSES = ['published', 'scheduled', 'draft', 'hidden', 'deleted'] as const

export type NewsStatus = (typeof NEWS_STATUSES)[number]

export const NEWS_STATUS_LABEL: Record<NewsStatus, string> = {
  published: '발행',
  scheduled: '예약',
  draft: '임시저장',
  hidden: '숨김',
  deleted: '삭제',
}

export const NEWS_STATUS_TONE: Record<NewsStatus, BadgeTone> = {
  published: 'success',
  scheduled: 'accent',
  draft: 'neutral',
  hidden: 'warn',
  deleted: 'danger',
}

export function isNewsStatus(value: string): value is NewsStatus {
  return (NEWS_STATUSES as readonly string[]).includes(value)
}

/** 상태 판정에 필요한 최소 컬럼. 목록·상세가 같은 함수를 쓴다. */
export type NewsStatusSource = {
  isPublished: boolean
  publishedAt: string
  isHidden: boolean
  deletedAt: string | null
}

/**
 * 행 → 표시 상태.
 *
 * 우선순위가 곧 운영 규칙이다. 삭제와 숨김은 **발행 여부보다 앞선다** —
 * 발행된 글을 숨겼는데 목록에 "발행"으로 남으면 조치가 반영되지 않은 것처럼 보인다.
 * 예약은 "발행으로 저장했지만 시각이 아직 오지 않은" 상태이고, 이는 공개 SELECT
 * 정책(`published_at <= now()`)과 같은 판정이라 화면과 실제 노출이 어긋나지 않는다.
 */
export function deriveNewsStatus(source: NewsStatusSource, now: Date = new Date()): NewsStatus {
  if (source.deletedAt !== null) {
    return 'deleted'
  }

  if (source.isHidden) {
    return 'hidden'
  }

  if (!source.isPublished) {
    return 'draft'
  }

  return new Date(source.publishedAt).getTime() > now.getTime() ? 'scheduled' : 'published'
}

/* ---------------------------------------------------------------------------
 * 감사 로그 스냅샷
 * ------------------------------------------------------------------------ */

/** 스냅샷을 만들 때 필요한 `posts` 컬럼. 조회 쪽과 액션 쪽이 같은 모양을 쓴다. */
export type NewsSnapshotRow = {
  title: string
  category_key: string
  is_published: boolean
  published_at: string
  is_hidden: boolean
  deleted_at: string | null
}

export type NewsSnapshot = {
  title: string
  status: NewsStatus
  category_key: string
}

/**
 * 감사 로그에 남기는 행 요약.
 *
 * 본문은 담지 않는다. 수십 KB 의 HTML 이 행마다 두 벌씩 쌓이면 로그 테이블이
 * 감사용이 아니라 백업본이 되고 목록 조회가 눈에 띄게 느려진다. 되짚어 볼 값
 * (제목 · 상태 · 말머리)만 남긴다.
 */
export function newsAuditSnapshot(row: NewsSnapshotRow, now: Date = new Date()): NewsSnapshot {
  return {
    title: row.title,
    category_key: row.category_key,
    status: deriveNewsStatus(
      {
        isPublished: row.is_published,
        publishedAt: row.published_at,
        isHidden: row.is_hidden,
        deletedAt: row.deleted_at,
      },
      now,
    ),
  }
}

/* ---------------------------------------------------------------------------
 * 클라이언트 노출 여부
 * ------------------------------------------------------------------------ */

export const NEWS_VISIBILITIES = ['visible', 'scheduled', 'invisible'] as const

export type NewsVisibility = (typeof NEWS_VISIBILITIES)[number]

export const NEWS_VISIBILITY_LABEL: Record<NewsVisibility, string> = {
  visible: '노출 중',
  scheduled: '예약',
  invisible: '비노출',
}

export const NEWS_VISIBILITY_TONE: Record<NewsVisibility, BadgeTone> = {
  visible: 'success',
  scheduled: 'accent',
  invisible: 'neutral',
}

/**
 * 사용자 사이트에 실제로 보이는가.
 *
 * 판정식은 사용자 사이트의 목록 쿼리(`lib/data/news.ts` 의 `getNewsList`)와
 * SELECT 정책(`posts_select_published`)을 **그대로** 옮긴 것이다.
 *
 *   is_published AND deleted_at IS NULL AND NOT is_hidden AND published_at <= now()
 *
 * 관리자 화면의 `NewsStatus` 는 "운영자가 무엇을 했는가"(임시저장·숨김·삭제)를
 * 구분하기 위한 편집 상태다. 그 값만 보고 노출 여부를 짐작하면 두 화면이 갈린다.
 * 그래서 노출 여부는 별도 함수로 뽑아 목록·상세에 함께 보여 준다.
 */
export function deriveNewsVisibility(
  source: NewsStatusSource,
  now: Date = new Date(),
): NewsVisibility {
  if (source.deletedAt !== null || source.isHidden || !source.isPublished) {
    return 'invisible'
  }

  return new Date(source.publishedAt).getTime() > now.getTime() ? 'scheduled' : 'visible'
}
