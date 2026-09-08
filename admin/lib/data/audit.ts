import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { pageRange } from '@/lib/utils/table-query'
import { kstLocalToIso } from '@/lib/validation/settings'

import type { Json } from '@/types/database.types'

/**
 * 감사 로그 조회 (`audit_logs`).
 *
 * 읽기 전용이다. 테이블에 UPDATE/DELETE 정책 자체가 없어(추가 전용) 화면에서도
 * 수정 경로를 만들지 않는다.
 */

export const AUDIT_PAGE_SIZE = 50

export type AuditLogItem = {
  id: string
  createdAt: string
  actorId: string | null
  actorName: string
  actorEmail: string | null
  action: string
  targetTable: string | null
  targetId: string | null
  before: Json | null
  after: Json | null
}

export type AuditFilters = {
  actorId: string | null
  targetTable: string | null
  action: string | null
  /** `YYYY-MM-DD`. 한국 시간 기준의 하루 경계로 환산한다. */
  from: string | null
  to: string | null
  /** 대상 ID 부분 일치. */
  q: string | null
  page: number
}

export type AuditListResult = {
  items: readonly AuditLogItem[]
  count: number
}

/* 행위자는 프로필과 조인해 닉네임·이메일을 함께 읽는다. 탈퇴하면 actor_id 가
   null 이 되므로(on delete set null) 조인 결과가 없을 수 있다. */
const COLUMNS =
  'id, created_at, action, target_table, target_id, before, after, actor:profiles!audit_logs_actor_id_fkey(id, nickname, email)'

type ActorJoin = { id: string; nickname: string; email: string | null } | null

function toItem(row: {
  id: string
  created_at: string
  action: string
  target_table: string | null
  target_id: string | null
  before: Json | null
  after: Json | null
  actor: ActorJoin
}): AuditLogItem {
  return {
    id: row.id,
    createdAt: row.created_at,
    actorId: row.actor?.id ?? null,
    actorName: row.actor?.nickname ?? '(삭제된 계정)',
    actorEmail: row.actor?.email ?? null,
    action: row.action,
    targetTable: row.target_table,
    targetId: row.target_id,
    before: row.before,
    after: row.after,
  }
}

export async function getAuditLogs(filters: AuditFilters): Promise<AuditListResult> {
  const supabase = await createClient()
  const [from, to] = pageRange(filters.page, AUDIT_PAGE_SIZE)

  let query = supabase.from('audit_logs').select(COLUMNS, { count: 'exact' })

  if (filters.actorId !== null) {
    query = query.eq('actor_id', filters.actorId)
  }

  if (filters.targetTable !== null) {
    query = query.eq('target_table', filters.targetTable)
  }

  if (filters.action !== null) {
    query = query.eq('action', filters.action)
  }

  const startIso = filters.from === null ? null : kstLocalToIso(`${filters.from}T00:00`)
  // 종료일은 그날 24시 직전까지 포함해야 한다. 날짜만 비교하면 당일 로그가 통째로 빠진다.
  const endIso = filters.to === null ? null : kstLocalToIso(`${filters.to}T23:59`)

  if (startIso !== null) {
    query = query.gte('created_at', startIso)
  }

  if (endIso !== null) {
    query = query.lte('created_at', endIso)
  }

  if (filters.q !== null && filters.q !== '') {
    query = query.ilike('target_id', `%${filters.q.replaceAll('%', '\\%')}%`)
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to)

  if (error !== null) {
    console.error('[audit] 조회 실패', error.message)

    return { items: [], count: 0 }
  }

  return { items: data.map(toItem), count: count ?? 0 }
}

export type AuditFilterOptions = {
  actors: readonly { value: string; label: string }[]
  tables: readonly string[]
  actions: readonly string[]
}

/** 필터 후보를 만들기 위해 훑는 최근 로그 수. 전량 스캔은 목록보다 비싸다. */
const OPTION_SCAN_LIMIT = 1000

/**
 * 필터 드롭다운 후보.
 *
 * 고정 목록이 아니라 **최근 로그에서 실제로 쓰인 값**으로 만든다. 모듈이 붙을
 * 때마다 새 action 문자열이 늘어나는데, 고정 목록이면 그때마다 여기를 고쳐야 하고
 * 고치지 않으면 필터가 조용히 뒤처진다.
 */
export async function getAuditFilterOptions(): Promise<AuditFilterOptions> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('audit_logs')
    .select('action, target_table, actor:profiles!audit_logs_actor_id_fkey(id, nickname, email)')
    .order('created_at', { ascending: false })
    .limit(OPTION_SCAN_LIMIT)

  if (error !== null) {
    console.error('[audit] 필터 후보 조회 실패', error.message)

    return { actors: [], tables: [], actions: [] }
  }

  const actors = new Map<string, string>()
  const tables = new Set<string>()
  const actions = new Set<string>()

  for (const row of data) {
    if (row.actor !== null) {
      actors.set(row.actor.id, `${row.actor.nickname} (${row.actor.email ?? '-'})`)
    }

    if (row.target_table !== null) {
      tables.add(row.target_table)
    }

    actions.add(row.action)
  }

  return {
    actors: [...actors].map(([value, label]) => ({ value, label })),
    tables: [...tables].sort(),
    actions: [...actions].sort(),
  }
}

/**
 * 대상 행 → 관리 화면 링크.
 *
 * 대상이 어디서 열리는지는 테이블마다 다르고, 아직 화면이 없는 테이블도 있다.
 * 매칭되지 않으면 null 을 돌려주고 화면은 링크 없이 ID 만 보여 준다.
 */
export function auditTargetHref(table: string | null, id: string | null): string | null {
  if (table === null) {
    return null
  }

  switch (table) {
    case 'gacha_items':
      return id === null ? '/gacha' : `/gacha/${id}`
    case 'rankings':
      return '/rankings'
    case 'site_settings':
    case 'hero_banners':
      return '/settings'
    case 'profiles':
      return id === null ? '/members' : `/members/${id}`
    case 'posts':
      return '/community/posts'
    case 'comments':
      return '/community/comments'
    case 'inquiries':
      return id === null ? '/inquiries' : `/inquiries/${id}`
    case 'faqs':
      return '/faqs'
    case 'reports':
      return '/reports'
    case 'admin_invites':
      return '/admins'
    default:
      return null
  }
}
