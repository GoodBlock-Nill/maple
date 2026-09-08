import 'server-only'

import { createClient } from '@/lib/supabase/server'

import type { Json } from '@/types/database.types'

/**
 * 감사 로그 기록.
 *
 * 세션 클라이언트로 넣는다(서비스 롤 아님). `audit_logs_insert_admin` 정책이
 * `actor_id = auth.uid()` 를 강제하므로, 남의 이름으로 로그를 남길 수 없고
 * 관리자가 아니면 애초에 통과하지 못한다 — 위조 불가능성이 DB 에서 보장된다.
 *
 * 기록 실패가 본 작업을 되돌리지는 않는다. 로그를 못 남겼다고 이미 끝난 제재를
 * 취소하면 상태가 더 어긋난다. 대신 서버 로그에 남겨 추적할 수 있게 한다.
 */
export type AuditEntry = {
  action: string
  targetTable?: string
  targetId?: string
  before?: Json
  after?: Json
}

export async function writeAuditLog(actorId: string, entry: AuditEntry): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('audit_logs').insert({
    actor_id: actorId,
    action: entry.action,
    target_table: entry.targetTable ?? null,
    target_id: entry.targetId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
  })

  if (error !== null) {
    console.error('[audit] 기록 실패', entry.action, error.message)
  }
}
