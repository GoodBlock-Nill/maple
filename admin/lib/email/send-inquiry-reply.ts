import 'server-only'

import { requireEnv } from '@/lib/supabase/env'
import { createClient } from '@/lib/supabase/server'

/**
 * 답신 메일 발송 — Edge Function `email-outbound` 호출.
 *
 * 관리자 콘솔은 **메일 제공자 비밀을 하나도 갖지 않는다.** API 키·웹훅 서명 키는
 * Supabase Edge Function 의 secret 에만 있고(docs/admin/EMAIL-INQUIRY-PLAN.md §6 · §8),
 * 여기서는 로그인한 관리자의 액세스 토큰으로 함수를 부르기만 한다. 그래서 발송 권한
 * 검사(관리자인지)는 함수 쪽 RLS·검증이 다시 하고, 새어 나갈 비밀도 없다.
 *
 * 함수와의 계약(요청 `{ replyId }` · 응답 코드별 의미)은 이 파일 한곳에 적어 둔다.
 * 제공자를 바꿔도 관리자 쪽은 이 파일만 본다.
 *
 * | 응답  | 본문                                        | 여기서의 해석      |
 * | ----- | ------------------------------------------- | ------------------ |
 * | 200   | `{ ok: true, status: 'sent'\|'queued', … }` | 성공               |
 * | 503   | `{ error: 'not_configured' }`               | 발송 설정 없음     |
 * | 401·403 | `{ error: 'unauthorized'\|'forbidden' }`  | 토큰·권한 문제     |
 * | 그 외 | `{ error: string }`                         | 실패(로그에만 남김) |
 *
 * **절대 throw 하지 않는다.** 답신은 이미 DB 에 저장된 뒤 호출되므로, 여기서 예외가
 * 나면 저장된 답신까지 실패한 것처럼 보인다.
 */

export type SendReplyResult =
  | { ok: true; status: 'sent' | 'queued' }
  | { ok: false; reason: 'not_configured' | 'unauthorized' | 'failed'; detail: string }

/**
 * 설정 전(제공자 미연동) 상태의 안내. 답변 등록과 '다시 보내기'가 같은 문장을 써야
 * 운영자가 두 화면에서 다른 원인을 상상하지 않는다.
 */
export const EMAIL_NOT_CONFIGURED_MESSAGE =
  "이메일 발송 설정이 아직 없습니다. 답신은 저장되었고, 설정 후 '다시 보내기'로 발송할 수 있습니다."

/** 제공자 왕복이 있어 기본 fetch 보다 넉넉하지만, 폼이 무한정 도는 것은 막는다. */
const TIMEOUT_MS = 15_000

function detailOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** 200 본문의 `status`. 파싱이 깨져도 발송 자체는 성공했으므로 'sent' 로 읽는다. */
function readSentStatus(body: string): 'sent' | 'queued' {
  try {
    const parsed: unknown = JSON.parse(body)

    if (typeof parsed === 'object' && parsed !== null) {
      return (parsed as { status?: unknown }).status === 'queued' ? 'queued' : 'sent'
    }
  } catch {
    /* 함수가 빈 본문이나 비 JSON 을 돌려준 경우. 상태 코드가 이미 성공을 말한다. */
  }

  return 'sent'
}

function mapResponse(status: number, body: string): SendReplyResult {
  if (status === 200) {
    return { ok: true, status: readSentStatus(body) }
  }

  if (status === 503) {
    return { ok: false, reason: 'not_configured', detail: `${status} ${body}` }
  }

  if (status === 401 || status === 403) {
    return { ok: false, reason: 'unauthorized', detail: `${status} ${body}` }
  }

  return { ok: false, reason: 'failed', detail: `${status} ${body}` }
}

export async function sendInquiryReplyEmail(replyId: string): Promise<SendReplyResult> {
  const supabase = await createClient()
  /* 호출부(서버 액션)가 이미 `requirePermission()` 으로 사용자를 검증했다. 여기서는
     함수에 넘길 토큰만 쿠키 세션에서 읽는다 — 인증을 대신하는 용도가 아니다. */
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session === null) {
    return { ok: false, reason: 'unauthorized', detail: 'no session' }
  }

  try {
    const response = await fetch(
      `${requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)}/functions/v1/email-outbound`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: requireEnv(
            'NEXT_PUBLIC_SUPABASE_ANON_KEY',
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          ),
        },
        body: JSON.stringify({ replyId }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    )

    return mapResponse(response.status, await response.text())
  } catch (error) {
    // 타임아웃(AbortError) · DNS · TLS 전부 여기로 온다. 원문은 호출부가 로그에만 남긴다.
    return { ok: false, reason: 'failed', detail: `network ${detailOf(error)}` }
  }
}
