import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { DEFAULT_PAGE_SIZE, pageRange, type SortState } from '@/lib/utils/table-query'
import { containsPattern, kstDayBoundary } from '@/lib/validation/moderation'

import type { Tables, TypedSupabaseClient, UserRole } from '@/lib/supabase/types'
import type { MemberProvider, MemberStatusFilter } from '@/lib/validation/members'

/* 회원 조회. `profiles_select_admin` 이 관리자에게만 전체 조회를 열어 주므로 세션
   클라이언트로 읽는다 — 서비스 롤로 읽으면 권한이 사라져도 목록이 그대로 보인다. */

export type MemberProfile = {
  id: string
  nickname: string
  email: string | null
  avatarUrl: string | null
  provider: string | null
  providerId: string | null
  role: UserRole
  suspendedUntil: string | null
  suspensionReason: string | null
  mswUid: string | null
  mswProfileCode: string | null
  termsAgreedAt: string | null
  privacyAgreedAt: string | null
  ageConfirmedAt: string | null
  createdAt: string
  updatedAt: string
}

/** 목록 행 = 프로필 + 페이지 단위로 센 활동 수치. */
export type MemberListItem = MemberProfile & {
  postCount: number
  commentCount: number
  reportedCount: number
}

export type MemberPostSummary = {
  id: string
  title: string
  categoryKey: string
  isHidden: boolean
  deletedAt: string | null
  createdAt: string
}

export type MemberCommentSummary = {
  id: string
  postId: string
  content: string
  isHidden: boolean
  deletedAt: string | null
  createdAt: string
}

export type MemberActivity = {
  postCount: number
  commentCount: number
  inquiryCount: number
  reportedCount: number
  reportsMadeCount: number
  posts: readonly MemberPostSummary[]
  comments: readonly MemberCommentSummary[]
}

export type MemberListParams = {
  q: string | null
  status: MemberStatusFilter | null
  provider: MemberProvider | null
  from: string | null
  to: string | null
  sort: SortState
  page: number
}

export type MemberListResult = {
  rows: readonly MemberListItem[]
  count: number
  page: number
}

const ACTIVITY_LIMIT = 20
const IN_CHUNK = 200

/* prettier-ignore — 한 줄 리터럴이어야 supabase-js 가 select 결과 타입을 추론한다. */
const PROFILE_COLUMNS =
  'id, nickname, email, avatar_url, provider, provider_id, role, suspended_until, suspension_reason, msw_uid, msw_profile_code, terms_agreed_at, privacy_agreed_at, age_confirmed_at, created_at, updated_at'

/* 컬럼 목록과 타입이 어긋나면 매퍼가 조용히 undefined 를 넣는다. 스키마에서 파생시킨다. */
type ProfileRow = Pick<
  Tables<'profiles'>,
  | 'id' | 'nickname' | 'email' | 'avatar_url' | 'provider' | 'provider_id' | 'role'
  | 'suspended_until' | 'suspension_reason' | 'msw_uid' | 'msw_profile_code'
  | 'terms_agreed_at' | 'privacy_agreed_at' | 'age_confirmed_at' | 'created_at' | 'updated_at'
>

function toProfile(row: ProfileRow): MemberProfile {
  return {
    id: row.id,
    nickname: row.nickname,
    email: row.email,
    avatarUrl: row.avatar_url,
    provider: row.provider,
    providerId: row.provider_id,
    role: row.role,
    suspendedUntil: row.suspended_until,
    suspensionReason: row.suspension_reason,
    mswUid: row.msw_uid,
    mswProfileCode: row.msw_profile_code,
    termsAgreedAt: row.terms_agreed_at,
    privacyAgreedAt: row.privacy_agreed_at,
    ageConfirmedAt: row.age_confirmed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getMembers(params: MemberListParams): Promise<MemberListResult> {
  const supabase = await createClient()
  const [from, to] = pageRange(params.page, DEFAULT_PAGE_SIZE)
  const now = new Date().toISOString()

  let query = supabase.from('profiles').select(PROFILE_COLUMNS, { count: 'exact' })

  const pattern = containsPattern(params.q)

  if (pattern !== null) {
    // `or` 는 필터 문자열을 그대로 파싱한다. 값에 콤마가 있으면 조건이 쪼개지므로 감싼다.
    query = query.or(`nickname.ilike."${pattern}",email.ilike."${pattern}"`)
  }

  if (params.provider === 'email') {
    // 이메일 가입은 provider 가 'email' 이거나(트리거) 아직 비어 있을 수 있다.
    query = query.or('provider.is.null,provider.eq.email')
  } else if (params.provider !== null) {
    query = query.eq('provider', params.provider)
  }

  if (params.status === 'admin') {
    query = query.eq('role', 'admin')
  } else if (params.status === 'suspended') {
    query = query.gt('suspended_until', now)
  } else if (params.status === 'normal') {
    query = query.eq('role', 'user').or(`suspended_until.is.null,suspended_until.lte.${now}`)
  }

  const since = kstDayBoundary(params.from)
  const until = kstDayBoundary(params.to, 1)

  if (since !== null) {
    query = query.gte('created_at', since)
  }

  if (until !== null) {
    query = query.lt('created_at', until)
  }

  const { data, count, error } = await query
    .order(params.sort.key, { ascending: params.sort.direction === 'asc' })
    .range(from, to)

  if (error !== null) {
    console.error('[members] 목록 조회 실패', error.message)

    return { rows: [], count: 0, page: params.page }
  }

  const rows = data ?? []
  const activity = await countActivity(
    supabase,
    rows.map((row) => row.id),
  )

  return {
    rows: rows.map((row) => ({
      ...toProfile(row),
      postCount: activity.posts.get(row.id) ?? 0,
      commentCount: activity.comments.get(row.id) ?? 0,
      reportedCount: activity.reported.get(row.id) ?? 0,
    })),
    count: count ?? 0,
    page: params.page,
  }
}

/* 활동 수치 — 회원당 3질의(20명이면 60질의)를 피하려고 페이지 단위로 한 번에 센다.
   PostgREST 기본 응답 상한(1000행)에 걸리면 수치가 잘린다. 정확한 값이 필요한
   상세 화면은 `count: 'exact'` 로 다시 센다. */
async function countActivity(
  supabase: TypedSupabaseClient,
  memberIds: readonly string[],
): Promise<{ posts: Map<string, number>; comments: Map<string, number>; reported: Map<string, number> }> {
  const posts = new Map<string, number>()
  const comments = new Map<string, number>()
  const reported = new Map<string, number>()

  if (memberIds.length === 0) {
    return { posts, comments, reported }
  }

  const ids = [...memberIds]
  const [postRows, commentRows] = await Promise.all([
    supabase.from('posts').select('id, author_id').eq('board', 'community').in('author_id', ids),
    supabase.from('comments').select('id, author_id').in('author_id', ids),
  ])

  /* 신고 집계는 대상 id → 작성자로 되짚어야 한다. 게시글·댓글 id 를 한 배열로 모아
     신고 테이블을 한 번만 읽는다. */
  const authorByTarget = new Map<string, string>()

  for (const row of postRows.data ?? []) {
    if (row.author_id !== null) {
      posts.set(row.author_id, (posts.get(row.author_id) ?? 0) + 1)
      authorByTarget.set(row.id, row.author_id)
    }
  }

  for (const row of commentRows.data ?? []) {
    if (row.author_id !== null) {
      comments.set(row.author_id, (comments.get(row.author_id) ?? 0) + 1)
      authorByTarget.set(row.id, row.author_id)
    }
  }

  const targetIds = [...authorByTarget.keys()]

  for (let index = 0; index < targetIds.length; index += IN_CHUNK) {
    // URL 길이 제한이 있다. id 를 200개씩 끊어 보낸다.
    const { data } = await supabase
      .from('reports')
      .select('target_id')
      .in('target_id', targetIds.slice(index, index + IN_CHUNK))

    for (const row of data ?? []) {
      const author = authorByTarget.get(row.target_id)

      if (author !== undefined) {
        reported.set(author, (reported.get(author) ?? 0) + 1)
      }
    }
  }

  return { posts, comments, reported }
}

export async function getMember(id: string): Promise<MemberProfile | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle()

  return data === null ? null : toProfile(data)
}

export async function getMemberActivity(id: string): Promise<MemberActivity> {
  const supabase = await createClient()

  const [postRows, commentRows, inquiries, reportsMade, counts] = await Promise.all([
    supabase
      .from('posts')
      .select('id, title, category_key, is_hidden, deleted_at, created_at', { count: 'exact' })
      .eq('board', 'community')
      .eq('author_id', id)
      .order('created_at', { ascending: false })
      .limit(ACTIVITY_LIMIT),
    supabase
      .from('comments')
      .select('id, post_id, content, is_hidden, deleted_at, created_at', { count: 'exact' })
      .eq('author_id', id)
      .order('created_at', { ascending: false })
      .limit(ACTIVITY_LIMIT),
    supabase.from('inquiries').select('id', { count: 'exact', head: true }).eq('user_id', id),
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('reporter_id', id),
    countActivity(supabase, [id]),
  ])

  return {
    postCount: postRows.count ?? 0,
    commentCount: commentRows.count ?? 0,
    inquiryCount: inquiries.count ?? 0,
    reportsMadeCount: reportsMade.count ?? 0,
    reportedCount: counts.reported.get(id) ?? 0,
    posts: (postRows.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      categoryKey: row.category_key,
      isHidden: row.is_hidden,
      deletedAt: row.deleted_at,
      createdAt: row.created_at,
    })),
    comments: (commentRows.data ?? []).map((row) => ({
      id: row.id,
      postId: row.post_id,
      content: row.content,
      isHidden: row.is_hidden,
      deletedAt: row.deleted_at,
      createdAt: row.created_at,
    })),
  }
}
