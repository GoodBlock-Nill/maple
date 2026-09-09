import 'server-only'

import { countActivity } from '@/lib/data/member-activity'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_PAGE_SIZE, pageRange, type SortState } from '@/lib/utils/table-query'
import { containsPattern, kstDayBoundary } from '@/lib/validation/moderation'

import type { Tables, UserRole } from '@/lib/supabase/types'
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
  /** 조회가 깨졌는지. `true` 면 `rows` 가 비어도 "데이터 없음"이 아니다(빈 표 오독 방지). */
  hasError: boolean
}

const ACTIVITY_LIMIT = 20

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

    return { rows: [], count: 0, page: params.page, hasError: true }
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
    hasError: false,
  }
}

export async function getMember(id: string): Promise<MemberProfile | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', id)
    .maybeSingle()

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
