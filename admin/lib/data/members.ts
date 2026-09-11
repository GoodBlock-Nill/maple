import 'server-only'

import { countActivity } from '@/lib/data/member-activity'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_PAGE_SIZE, pageRange } from '@/lib/utils/table-query'
import { containsPattern, kstDayBoundary } from '@/lib/validation/moderation'

import type { Tables, UserRole } from '@/lib/supabase/types'
import type { MemberListParams } from '@/lib/validation/member-list-params'

/* 회원 조회. `profiles_select_admin` 이 관리자에게만 전체 조회를 열어 주므로 세션
   클라이언트로 읽는다 — 서비스 롤로 읽으면 권한이 사라져도 목록이 그대로 보인다. */

export type MemberProfile = {
  id: string
  nickname: string
  /** 마이페이지에서 본인이 적는 실명(선택). 없으면 null. */
  name: string | null
  email: string | null
  avatarUrl: string | null
  provider: string | null
  providerId: string | null
  role: UserRole
  suspendedUntil: string | null
  suspensionReason: string | null
  mswUid: string | null
  mswProfileCode: string | null
  /** 마케팅 SMS 수신거부. `true` 면 보내지 않는다. 바꾸는 주체는 본인뿐이다. */
  marketingSmsOptOut: boolean
  /** 마케팅 이메일 수신거부. */
  marketingEmailOptOut: boolean
  /** 탈퇴 요청 시각. `null` 이면 정상. 판정은 `lib/validation/member-status.ts` 가 한다. */
  deletedAt: string | null
  /** 개인정보 파기 시각. `null` 이면 아직 파기 전(보존 기간 중이거나 정상). */
  purgedAt: string | null
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

/* 쿼리스트링 파싱은 순수 모듈(`lib/validation/member-list-params.ts`)이 맡는다 —
   서버 전용인 이 모듈에 두면 단위 테스트가 Supabase 클라이언트까지 끌어와야 한다.
   호출부는 지금까지처럼 여기서 타입을 가져올 수 있게 이름만 다시 내보낸다. */
export type { MemberListParams }

export type MemberListResult = {
  rows: readonly MemberListItem[]
  count: number
  page: number
  /** 조회가 깨졌는지. `true` 면 `rows` 가 비어도 "데이터 없음"이 아니다(빈 표 오독 방지). */
  hasError: boolean
}

/** 회원 상세 활동 탭 한 건당 상한. `member-inquiries.ts` 가 같은 숫자를 쓴다 —
 *  탭마다 보여 주는 건수가 달라 보이면 운영자가 "왜 이 탭만 더 보이냐"고 묻는다. */
export const ACTIVITY_LIMIT = 20

/* prettier-ignore — 한 줄 리터럴이어야 supabase-js 가 select 결과 타입을 추론한다. */
const PROFILE_COLUMNS =
  'id, nickname, name, email, avatar_url, provider, provider_id, role, suspended_until, suspension_reason, msw_uid, msw_profile_code, marketing_sms_opt_out, marketing_email_opt_out, deleted_at, purged_at, terms_agreed_at, privacy_agreed_at, age_confirmed_at, created_at, updated_at'

/* 컬럼 목록과 타입이 어긋나면 매퍼가 조용히 undefined 를 넣는다. 스키마에서 파생시킨다. */
type ProfileRow = Pick<
  Tables<'profiles'>,
  | 'id'
  | 'nickname'
  | 'name'
  | 'email'
  | 'avatar_url'
  | 'provider'
  | 'provider_id'
  | 'role'
  | 'suspended_until'
  | 'suspension_reason'
  | 'msw_uid'
  | 'msw_profile_code'
  | 'marketing_sms_opt_out'
  | 'marketing_email_opt_out'
  | 'deleted_at'
  | 'purged_at'
  | 'terms_agreed_at'
  | 'privacy_agreed_at'
  | 'age_confirmed_at'
  | 'created_at'
  | 'updated_at'
>

function toProfile(row: ProfileRow): MemberProfile {
  return {
    id: row.id,
    nickname: row.nickname,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url,
    provider: row.provider,
    providerId: row.provider_id,
    role: row.role,
    suspendedUntil: row.suspended_until,
    suspensionReason: row.suspension_reason,
    mswUid: row.msw_uid,
    mswProfileCode: row.msw_profile_code,
    marketingSmsOptOut: row.marketing_sms_opt_out,
    marketingEmailOptOut: row.marketing_email_opt_out,
    deletedAt: row.deleted_at,
    purgedAt: row.purged_at,
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

  /* 상태 필터. 뱃지와 달리 서로 배타적이지 않다 — "탈퇴 대기이면서 정지"인 회원은
     양쪽에서 찾을 수 있어야 한다. 다만 '정상'만은 탈퇴·파기를 반드시 제외한다.
     그 칸이 넓어지면 이미 나간 회원이 정상 명단에 섞인다. */
  if (params.status === 'admin') {
    query = query.eq('role', 'admin')
  } else if (params.status === 'suspended') {
    query = query.gt('suspended_until', now)
  } else if (params.status === 'withdrawn') {
    query = query.not('deleted_at', 'is', null).is('purged_at', null)
  } else if (params.status === 'purged') {
    query = query.not('purged_at', 'is', null)
  } else if (params.status === 'normal') {
    query = query
      .eq('role', 'user')
      .is('deleted_at', null)
      .or(`suspended_until.is.null,suspended_until.lte.${now}`)
  }

  if (params.msw !== null) {
    /* 월드 계정 중복 검색. 부분 일치를 쓰지 않는다 — UID 는 10~20자리 숫자라
       부분 일치로 훑으면 관계없는 계정이 딸려 오고, 중복 점검의 답이 흐려진다.
       프로필 코드는 대소문자를 가리지 않으므로 `ilike` 로 **정확히** 비교한다. */
    const value = params.msw.replace(/[\\%_]/g, (match) => `\\${match}`)
    query = query.or(`msw_uid.eq."${value}",msw_profile_code.ilike."${value}"`)
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
