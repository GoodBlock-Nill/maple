import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { DEFAULT_PAGE_SIZE, pageRange } from '@/lib/utils/table-query'
import { REPORT_STATUSES } from '@/lib/validation/moderation'

import type { Enums, TypedSupabaseClient } from '@/lib/supabase/types'
import type { ReportStatus } from '@/lib/validation/moderation'

/* 신고 큐 조회. `reports.target_id` 는 게시글·댓글 두 테이블을 가리키는 다형 참조라
   FK 가 없고 임베드로 끌어올 수 없다. 한 페이지분 id 를 모아 테이블별로 한 번씩 읽으면
   질의 수가 페이지 크기와 무관하게 4로 고정된다. 상세 다이얼로그에 필요한 본문과 신고
   이력도 이 4질의에서 함께 채운다 — 행마다 다시 읽으면 20건 목록이 60질의가 된다. */

export type ReportTargetType = 'post' | 'comment'

export type ReportTarget = {
  type: ReportTargetType
  id: string
  /** 게시글이면 제목, 댓글이면 본문 발췌. */
  excerpt: string
  /** 전문(상세 다이얼로그용). */
  content: string
  /** 댓글일 때 원 게시글 id — 미리보기 링크에 필요하다. */
  postId: string | null
  authorId: string | null
  authorName: string
  isHidden: boolean
  deletedAt: string | null
}

export type ReportHistoryItem = {
  id: string
  reason: Enums<'report_reason'>
  detail: string | null
  status: ReportStatus
  createdAt: string
  reporterNickname: string
}

export type ReportItem = {
  id: string
  targetType: ReportTargetType
  targetId: string
  reason: Enums<'report_reason'>
  detail: string | null
  status: ReportStatus
  createdAt: string
  reporterId: string
  reporterNickname: string
  target: ReportTarget | null
  /** 같은 대상에 접수된 모든 신고(상태 무관, 최신순). 누적 신고 수는 이 길이다. */
  history: readonly ReportHistoryItem[]
  /** 같은 대상에 아직 열려 있는 신고 수(일괄 처리 안내에 쓴다). */
  openCountForTarget: number
}

export type ReportListResult = {
  rows: readonly ReportItem[]
  count: number
  page: number
}

export type ReportCounts = Record<ReportStatus, number>

/* prettier-ignore — 한 줄 리터럴이어야 supabase-js 가 select 결과 타입을 추론한다. */
const REPORT_COLUMNS =
  'id, target_type, target_id, reason, detail, status, created_at, reporter_id, profiles(nickname)'

const EXCERPT_MAX = 60

function excerpt(value: string, max = EXCERPT_MAX): string {
  const flat = value.replace(/\s+/g, ' ').trim()

  return flat.length <= max ? flat : `${flat.slice(0, max)}…`
}

function toTargetType(value: string): ReportTargetType {
  return value === 'comment' ? 'comment' : 'post'
}

function toStatus(value: string): ReportStatus {
  return REPORT_STATUSES.includes(value as ReportStatus) ? (value as ReportStatus) : 'open'
}

function targetKey(type: ReportTargetType, id: string): string {
  return `${type}:${id}`
}

type ReportRowShape = {
  id: string
  target_type: string
  target_id: string
  reason: Enums<'report_reason'>
  detail: string | null
  status: string
  created_at: string
  reporter_id: string
  profiles: { nickname: string } | null
}

async function loadTargets(
  supabase: TypedSupabaseClient,
  rows: readonly ReportRowShape[],
): Promise<Map<string, ReportTarget>> {
  const idsOf = (type: ReportTargetType): string[] => [
    ...new Set(rows.filter((row) => toTargetType(row.target_type) === type).map((row) => row.target_id)),
  ]

  const postIds = idsOf('post')
  const commentIds = idsOf('comment')

  const [posts, comments] = await Promise.all([
    postIds.length === 0
      ? null
      : supabase
          .from('posts')
          .select('id, title, content, author_id, author_name, is_hidden, deleted_at')
          .in('id', postIds),
    commentIds.length === 0
      ? null
      : supabase
          .from('comments')
          .select('id, post_id, content, author_id, author_name, is_hidden, deleted_at')
          .in('id', commentIds),
  ])

  const targets = new Map<string, ReportTarget>()

  for (const row of posts?.data ?? []) {
    targets.set(targetKey('post', row.id), {
      type: 'post',
      id: row.id,
      excerpt: excerpt(row.title),
      content: row.content,
      postId: row.id,
      authorId: row.author_id,
      authorName: row.author_name,
      isHidden: row.is_hidden,
      deletedAt: row.deleted_at,
    })
  }

  for (const row of comments?.data ?? []) {
    targets.set(targetKey('comment', row.id), {
      type: 'comment',
      id: row.id,
      excerpt: excerpt(row.content),
      content: row.content,
      postId: row.post_id,
      authorId: row.author_id,
      authorName: row.author_name,
      isHidden: row.is_hidden,
      deletedAt: row.deleted_at,
    })
  }

  return targets
}

/** 대상별 신고 이력. 한 질의로 받아 애플리케이션에서 묶는다(집계 RPC 가 없다). */
async function loadTargetHistory(
  supabase: TypedSupabaseClient,
  rows: readonly ReportRowShape[],
): Promise<Map<string, ReportHistoryItem[]>> {
  const ids = [...new Set(rows.map((row) => row.target_id))]
  const history = new Map<string, ReportHistoryItem[]>()

  if (ids.length === 0) {
    return history
  }

  const { data } = await supabase
    .from('reports')
    .select(REPORT_COLUMNS)
    .in('target_id', ids)
    .order('created_at', { ascending: false })

  for (const row of data ?? []) {
    const key = targetKey(toTargetType(row.target_type), row.target_id)
    const bucket = history.get(key) ?? []

    bucket.push({
      id: row.id,
      reason: row.reason,
      detail: row.detail,
      status: toStatus(row.status),
      createdAt: row.created_at,
      reporterNickname: row.profiles?.nickname ?? '(탈퇴)',
    })
    history.set(key, bucket)
  }

  return history
}

function toReportItem(
  row: ReportRowShape,
  targets: Map<string, ReportTarget>,
  history: Map<string, ReportHistoryItem[]>,
): ReportItem {
  const type = toTargetType(row.target_type)
  const key = targetKey(type, row.target_id)
  const targetHistory = history.get(key) ?? []

  return {
    id: row.id,
    targetType: type,
    targetId: row.target_id,
    reason: row.reason,
    detail: row.detail,
    status: toStatus(row.status),
    createdAt: row.created_at,
    reporterId: row.reporter_id,
    reporterNickname: row.profiles?.nickname ?? '(탈퇴)',
    target: targets.get(key) ?? null,
    history: targetHistory,
    openCountForTarget: targetHistory.filter((item) => item.status === 'open').length,
  }
}

export async function getReportCounts(): Promise<ReportCounts> {
  const supabase = await createClient()

  const [open, resolved, dismissed] = await Promise.all(
    REPORT_STATUSES.map((status) =>
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', status),
    ),
  )

  return {
    open: open?.count ?? 0,
    resolved: resolved?.count ?? 0,
    dismissed: dismissed?.count ?? 0,
  }
}

export async function getReports(status: ReportStatus, page: number): Promise<ReportListResult> {
  const supabase = await createClient()
  const [from, to] = pageRange(page, DEFAULT_PAGE_SIZE)

  const { data, count, error } = await supabase
    .from('reports')
    .select(REPORT_COLUMNS, { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error !== null) {
    console.error('[reports] 목록 조회 실패', error.message)

    return { rows: [], count: 0, page }
  }

  const rows = data ?? []
  const [targets, history] = await Promise.all([
    loadTargets(supabase, rows),
    loadTargetHistory(supabase, rows),
  ])

  return {
    rows: rows.map((row) => toReportItem(row, targets, history)),
    count: count ?? 0,
    page,
  }
}

/* 회원 상세의 "신고" 탭 — 접수한 신고(reporterId)와 받은 신고(targetIds). 두 목록은
   필터만 다르고 조립이 같아 한 함수로 둔다(표기가 갈리지 않는다). */
export async function getReportsFor(
  filter: { reporterId?: string; targetIds?: readonly string[] },
  limit = 20,
): Promise<readonly ReportItem[]> {
  const supabase = await createClient()

  if (filter.targetIds !== undefined && filter.targetIds.length === 0) {
    return []
  }

  let query = supabase.from('reports').select(REPORT_COLUMNS)

  if (filter.reporterId !== undefined) {
    query = query.eq('reporter_id', filter.reporterId)
  }

  if (filter.targetIds !== undefined) {
    query = query.in('target_id', [...filter.targetIds])
  }

  const { data } = await query.order('created_at', { ascending: false }).limit(limit)
  const rows = data ?? []
  const [targets, history] = await Promise.all([
    loadTargets(supabase, rows),
    loadTargetHistory(supabase, rows),
  ])

  return rows.map((row) => toReportItem(row, targets, history))
}
