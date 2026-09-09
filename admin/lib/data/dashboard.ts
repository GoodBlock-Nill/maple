import 'server-only'

import { createClient } from '@/lib/supabase/server'

import type { TypedSupabaseClient } from '@/lib/supabase/types'

/**
 * 대시보드 지표 — 전부 실데이터, 읽기 전용.
 *
 * 집계는 `count: 'exact', head: true` 로 낸다. 행을 실제로 가져오지 않으므로
 * 네트워크 페이로드가 0 이고, 지표가 늘어도 응답 크기가 커지지 않는다.
 * 14개 남짓한 질의는 서로 의존하지 않으니 `Promise.all` 로 한 번에 던진다.
 *
 * "오늘"의 기준은 한국시간 자정이다. UTC 자정으로 세면 오전 9시 이전의 글이
 * 어제로 밀려 운영자가 보는 숫자와 실제가 어긋난다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** 집계가 깨진 창은 `null` 이다. 0 으로 눌러 담으면 화면이 "오늘 0건"이라고 거짓말한다. */
export type MetricWindow = {
  today: number | null
  week: number | null
  month: number | null
}

export type DashboardMetrics = {
  profiles: MetricWindow
  newsPosts: MetricWindow
  communityPosts: MetricWindow
  comments: MetricWindow
  openReports: number | null
  pendingInquiries: number | null
  /** 탈퇴 후 보존 기간 중(개인정보 파기 전)인 회원 수. */
  withdrawnPending: number | null
  /** 최근 7일 안에 개인정보가 파기된 회원 수. */
  purgedThisWeek: number | null
}

export type ActivityKind = 'news' | 'community' | 'comment' | 'inquiry' | 'report'

export type ActivityItem = {
  id: string
  kind: ActivityKind
  title: string
  actor: string
  createdAt: string
  href: string
}

/** 한국시간 기준 오늘 자정의 UTC 시각. */
export function kstStartOfDay(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + KST_OFFSET_MS)
  shifted.setUTCHours(0, 0, 0, 0)

  return new Date(shifted.getTime() - KST_OFFSET_MS)
}

type Boundaries = { today: string; week: string; month: string }

function boundaries(now: Date): Boundaries {
  return {
    today: kstStartOfDay(now).toISOString(),
    week: new Date(now.getTime() - 7 * DAY_MS).toISOString(),
    month: new Date(now.getTime() - 30 * DAY_MS).toISOString(),
  }
}

/**
 * 집계 질의의 최소 계약.
 *
 * 테이블마다 select 결과 타입이 달라 빌더를 그대로 유니온으로 묶으면 `.eq('board')`
 * 같은 테이블 고유 필터가 교집합에서 사라진다. 호출부가 완성한 질의를 받아
 * 실행만 하는 형태로 두면 각 질의가 자기 테이블 타입으로 온전히 검사된다.
 */
type CountQuery = PromiseLike<{ count: number | null; error: { message: string } | null }>

async function runCount(label: string, query: CountQuery): Promise<number | null> {
  const { count, error } = await query

  if (error !== null) {
    console.error(`[dashboard] ${label} 집계 실패`, error.message)

    return null
  }

  return count ?? 0
}

async function windowFor(
  label: string,
  bounds: Boundaries,
  build: (since: string) => CountQuery,
): Promise<MetricWindow> {
  const [today, week, month] = await Promise.all([
    runCount(label, build(bounds.today)),
    runCount(label, build(bounds.week)),
    runCount(label, build(bounds.month)),
  ])

  return { today, week, month }
}

function countPostsSince(
  supabase: TypedSupabaseClient,
  board: 'news' | 'community',
  since: string,
): CountQuery {
  return supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('board', board)
    .gte('created_at', since)
}

export async function getDashboardMetrics(now: Date = new Date()): Promise<DashboardMetrics> {
  const supabase = await createClient()
  const bounds = boundaries(now)

  const [
    profiles,
    newsPosts,
    communityPosts,
    comments,
    reports,
    inquiries,
    withdrawnPending,
    purgedThisWeek,
  ] = await Promise.all([
    windowFor('profiles', bounds, (since) =>
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since),
    ),
    windowFor('posts:news', bounds, (since) => countPostsSince(supabase, 'news', since)),
    windowFor('posts:community', bounds, (since) => countPostsSince(supabase, 'community', since)),
    windowFor('comments', bounds, (since) =>
      supabase
        .from('comments')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since),
    ),
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('inquiries').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    /* 탈퇴 대기 = 탈퇴했고 아직 파기되지 않은 회원. 파기까지 남은 시간이 있는
       사람들이라 이 숫자가 곧 "지금 복구가 가능한 회원 수"이기도 하다. */
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .not('deleted_at', 'is', null)
      .is('purged_at', null),
    /* 파기는 되돌릴 수 없다. 배치가 도는지, 몇 명이 지워졌는지를 대시보드에서
       바로 볼 수 없으면 사고가 나도 며칠 뒤에야 알게 된다. */
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('purged_at', bounds.week),
  ])

  return {
    profiles,
    newsPosts,
    communityPosts,
    comments,
    openReports: toCount('reports:open', reports),
    pendingInquiries: toCount('inquiries:pending', inquiries),
    withdrawnPending: toCount('profiles:withdrawn', withdrawnPending),
    purgedThisWeek: toCount('profiles:purged', purgedThisWeek),
  }
}

/** 이미 실행된 집계 응답을 지표 값으로 좁힌다. 실패는 `runCount()` 와 같게 null 로 둔다. */
function toCount(
  label: string,
  result: { count: number | null; error: { message: string } | null },
): number | null {
  if (result.error !== null) {
    console.error(`[dashboard] ${label} 집계 실패`, result.error.message)

    return null
  }

  return result.count ?? 0
}

const RECENT_LIMIT = 10

/**
 * 최근 활동 — 게시글 · 댓글 · 문의 · 신고를 시간순으로 합친다.
 *
 * DB 뷰(union)로 만들지 않는 이유: 네 테이블의 RLS 가 각각 다르고, 뷰는 정의자
 * 권한으로 돌아 관리자 정책이 우회될 여지가 생긴다. 각 테이블에서 10건씩 읽어
 * 애플리케이션에서 합치면 권한 판단이 원래 자리에 그대로 남는다.
 */
export async function getRecentActivity(): Promise<readonly ActivityItem[]> {
  const supabase = await createClient()

  const [posts, comments, inquiries, reports] = await Promise.all([
    supabase
      .from('posts')
      .select('id, title, board, author_name, created_at')
      .order('created_at', { ascending: false })
      .limit(RECENT_LIMIT),
    supabase
      .from('comments')
      .select('id, content, author_name, created_at')
      .order('created_at', { ascending: false })
      .limit(RECENT_LIMIT),
    supabase
      .from('inquiries')
      .select('id, title, category, created_at')
      .order('created_at', { ascending: false })
      .limit(RECENT_LIMIT),
    supabase
      .from('reports')
      .select('id, target_type, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(RECENT_LIMIT),
  ])

  const items: ActivityItem[] = [
    ...(posts.data ?? []).map((row) => ({
      id: `post-${row.id}`,
      kind: (row.board === 'news' ? 'news' : 'community') as ActivityKind,
      title: row.title,
      actor: row.author_name,
      createdAt: row.created_at,
      href: row.board === 'news' ? '/news' : '/community/posts',
    })),
    ...(comments.data ?? []).map((row) => ({
      id: `comment-${row.id}`,
      kind: 'comment' as ActivityKind,
      title: truncate(row.content),
      actor: row.author_name,
      createdAt: row.created_at,
      href: '/community/comments',
    })),
    ...(inquiries.data ?? []).map((row) => ({
      id: `inquiry-${row.id}`,
      kind: 'inquiry' as ActivityKind,
      title: row.title,
      actor: row.category,
      createdAt: row.created_at,
      href: '/inquiries',
    })),
    ...(reports.data ?? []).map((row) => ({
      id: `report-${row.id}`,
      kind: 'report' as ActivityKind,
      title: `${row.target_type === 'post' ? '게시글' : '댓글'} 신고 · ${row.reason}`,
      actor: '신고 접수',
      createdAt: row.created_at,
      href: '/reports',
    })),
  ]

  return items
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, RECENT_LIMIT)
}

function truncate(value: string, max = 40): string {
  const flat = value.replace(/\s+/g, ' ').trim()

  return flat.length <= max ? flat : `${flat.slice(0, max)}…`
}
