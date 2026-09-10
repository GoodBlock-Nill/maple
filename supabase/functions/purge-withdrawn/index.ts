/**
 * purge-withdrawn — 탈퇴 후 90일이 지난 계정의 개인정보를 파기하는 일일 배치.
 *
 * 순서(docs/admin/ACCOUNT-WITHDRAWAL-PLAN.md §4.3)
 *   1) DB 함수 `purge_withdrawn_profiles()` (SECURITY DEFINER · service_role 전용) 가 프로필을
 *      익명화하고 `member.purge` 감사 로그를 남긴 뒤 처리한 id 를 돌려준다.
 *   2) 각 id 에 대해 `auth.admin.deleteUser` 로 로그인 계정(이메일·간편로그인 식별자)을 지운다.
 *      실패하면 그 프로필의 `purged_at` 을 비워 다음 날 다시 태운다(한 건이 막혀도 나머지는 계속).
 *   3) 곁다리 청소 — 접수되지 않은 채 24시간이 지난 1:1 문의 영상 첨부
 *      (`inquiry-attachments/<uid>/pending/…`)를 지운다. 폼에 영상만 올려 두고 떠난
 *      사용자의 파일은 아무 문의도 참조하지 않는다. SQL 로 storage.objects 를 지우면
 *      실제 파일이 남으므로 경로만 함수로 받아 Storage API 로 지운다. 실패해도 위의
 *      파기 결과에는 영향을 주지 않는다(개인정보 파기가 곁다리 청소에 막히면 안 된다).
 *
 * 인가 — 둘 중 하나.
 *   * `x-cron-secret` 헤더 == secret `CRON_SECRET` (pg_cron 이 Vault 에서 읽어 보낸다)
 *   * `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` (수동 실행)
 *   게이트웨이 JWT 검증은 끈다(config.toml `[functions.purge-withdrawn] verify_jwt = false`).
 *
 * 요청  POST {} · 선택 body { "cutoffDays": 90 }(테스트용 · 1 이상 정수)
 * 응답  200 { ok, purged, authDeleted, pendingAttachmentsRemoved, failed: [{ id, reason }] }
 *       401 unauthorized · 405 method_not_allowed · 500 purge_failed · 503 not_configured
 */

import { readEnv, requireEnv } from '../_shared/deno/env.ts'
import { createServiceClient, json } from '../_shared/deno/supabase.ts'

import type { SupabaseClient } from '@supabase/supabase-js'

const DEFAULT_CUTOFF_DAYS = 90
const MAX_CUTOFF_DAYS = 3650

/** 접수 전 영상이 머무는 버킷과 유예 시간. 같은 날 이어서 쓰는 사용자를 자르지 않는다. */
const ATTACHMENT_BUCKET = 'inquiry-attachments'
const PENDING_ATTACHMENT_CUTOFF_HOURS = 24

/** 길이가 달라도 같은 시간이 걸리도록 바이트 단위로 비교한다(타이밍 누출 방지). */
function secretEquals(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given)
  const b = new TextEncoder().encode(expected)
  let diff = a.length ^ b.length

  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  }

  return diff === 0
}

function isAuthorized(request: Request): boolean {
  const cronSecret = readEnv('CRON_SECRET')
  const givenSecret = request.headers.get('x-cron-secret')

  if (cronSecret !== null && givenSecret !== null && secretEquals(givenSecret, cronSecret)) {
    return true
  }

  const authorization = request.headers.get('Authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : ''

  return token !== '' && secretEquals(token, requireEnv('SUPABASE_SERVICE_ROLE_KEY'))
}

async function readCutoffDays(request: Request): Promise<number> {
  try {
    const body = (await request.json()) as { cutoffDays?: unknown }
    const value = body.cutoffDays

    if (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= MAX_CUTOFF_DAYS
    ) {
      return value
    }
  } catch {
    /* 본문이 없거나 JSON 이 아니면 기본값. */
  }

  return DEFAULT_CUTOFF_DAYS
}

type Failure = { id: string; reason: string }

/** auth 삭제. "이미 없음"은 성공으로 본다(지난 실행에서 지워졌을 수 있다). */
async function deleteAuthUser(service: SupabaseClient, id: string): Promise<Failure | null> {
  const { error } = await service.auth.admin.deleteUser(id)

  if (error === null || error.status === 404) {
    return null
  }

  return { id, reason: error.message }
}

/**
 * 버려진 pending 첨부 청소.
 *
 * 본 작업(개인정보 파기)과 독립이라 실패를 삼킨다 — 스토리지가 잠깐 흔들렸다고
 * 파기 배치가 500 을 돌려주면 그날 파기 대상이 통째로 밀린다.
 */
async function sweepPendingAttachments(service: SupabaseClient): Promise<number> {
  try {
    const { data, error } = await service.rpc('stale_inquiry_pending_attachments', {
      p_cutoff_hours: PENDING_ATTACHMENT_CUTOFF_HOURS,
    })

    if (error !== null) {
      console.error('[purge-withdrawn] pending 첨부 조회 실패', error.message)

      return 0
    }

    const paths = ((data as { path: string }[] | null) ?? []).map((row) => row.path)

    if (paths.length === 0) {
      return 0
    }

    const removed = await service.storage.from(ATTACHMENT_BUCKET).remove(paths)

    if (removed.error !== null) {
      console.error('[purge-withdrawn] pending 첨부 삭제 실패', removed.error.message)

      return 0
    }

    return removed.data?.length ?? 0
  } catch (thrown) {
    console.error('[purge-withdrawn] pending 첨부 청소 중 예외', String(thrown))

    return 0
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' })
  }

  if (readEnv('CRON_SECRET') === null && readEnv('SUPABASE_SERVICE_ROLE_KEY') === null) {
    return json(503, { error: 'not_configured' })
  }

  if (!isAuthorized(request)) {
    return json(401, { error: 'unauthorized' })
  }

  const cutoffDays = await readCutoffDays(request)
  const service = createServiceClient()

  const { data, error } = await service.rpc('purge_withdrawn_profiles', {
    p_cutoff: `${cutoffDays} days`,
  })

  if (error !== null) {
    console.error('[purge-withdrawn] 파기 함수 실패', error.message)

    return json(500, { error: 'purge_failed' })
  }

  const ids = (data as unknown as string[] | null) ?? []
  const failed: Failure[] = []

  for (const id of ids) {
    const failure = await deleteAuthUser(service, id)

    if (failure === null) {
      continue
    }

    console.error('[purge-withdrawn] auth 계정 삭제 실패', failure.id, failure.reason)
    failed.push(failure)

    /* 개인정보는 이미 지워졌지만 로그인 계정이 남았다. 표식을 되돌려 다음 실행이 다시
       시도하게 한다(익명화는 멱등이라 두 번 돌아도 같은 값이다). */
    const { error: resetError } = await service
      .from('profiles')
      .update({ purged_at: null })
      .eq('id', id)

    if (resetError !== null) {
      console.error('[purge-withdrawn] purged_at 되돌리기 실패', id, resetError.message)
    }
  }

  const pendingAttachmentsRemoved = await sweepPendingAttachments(service)

  console.log(
    `[purge-withdrawn] purged=${ids.length} authDeleted=${ids.length - failed.length} ` +
      `pendingAttachmentsRemoved=${pendingAttachmentsRemoved}`,
  )

  return json(200, {
    ok: true,
    purged: ids.length,
    authDeleted: ids.length - failed.length,
    pendingAttachmentsRemoved,
    failed,
  })
})
