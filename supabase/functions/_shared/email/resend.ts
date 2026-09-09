/**
 * 제공자 어댑터 — Resend.
 *
 * 제공자 차이를 이 파일 하나에 가둔다(기획서 §2). Postmark 를 붙이려면 같은
 * `EmailProvider` 를 구현하는 파일을 하나 더 만들고 함수 진입점에서 고른다.
 *
 * 확인된 문서:
 *  - 수신 메일 조회  GET https://api.resend.com/emails/receiving/{email_id}
 *    (text · html · headers(객체) · message_id · attachments[{id,filename,content_type,size}])
 *    https://resend.com/docs/api-reference/emails/retrieve-received-email
 *  - 첨부 목록      GET …/emails/receiving/{email_id}/attachments → data[{download_url, expires_at, size, …}]
 *    https://resend.com/docs/api-reference/emails/list-received-email-attachments
 *  - 발송           POST https://api.resend.com/emails (from · to · subject · text · reply_to · headers · Idempotency-Key)
 *    https://resend.com/docs/api-reference/emails/send-email
 *  - 모든 요청에 User-Agent 가 없으면 403(코드 1010) — https://resend.com/docs/api-reference/introduction
 */

const RESEND_API = 'https://api.resend.com'

const USER_AGENT = 'maple-email-inquiry/1.0 (+supabase-edge)'

const FETCH_TIMEOUT_MS = 15_000

export type ProviderSendRequest = {
  from: string
  to: string
  subject: string
  text: string
  replyTo: string | null
  /** In-Reply-To · References 등 스레딩 헤더. */
  headers: Record<string, string>
  /** 같은 답신의 재시도가 두 통이 되지 않게 하는 키(Resend: 24시간 유효). */
  idempotencyKey: string | null
}

export type ProviderSendResult =
  { ok: true; providerId: string } | { ok: false; status: number; detail: string }

export type ProviderAttachment = {
  id: string
  filename: string
  contentType: string
  size: number | null
  downloadUrl: string | null
}

export type EmailProvider = {
  /** 웹훅이 메타데이터만 줄 때 전체 메일(본문·헤더·첨부 목록)을 받아 온다. 없으면 null. */
  fetchReceivedEmail: (emailId: string) => Promise<unknown | null>
  /** 첨부 내려받기 주소 목록. */
  listReceivedAttachments: (emailId: string) => Promise<ProviderAttachment[]>
  send: (request: ProviderSendRequest) => Promise<ProviderSendResult>
}

function resendFetch(apiKey: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${RESEND_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'User-Agent': USER_AGENT,
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

export function createResendProvider(apiKey: string): EmailProvider {
  return {
    async fetchReceivedEmail(emailId) {
      const response = await resendFetch(apiKey, `/emails/receiving/${encodeURIComponent(emailId)}`)

      if (!response.ok) {
        console.error('[email] 수신 메일 조회 실패', response.status, await response.text())

        return null
      }

      return response.json()
    },

    async listReceivedAttachments(emailId) {
      const response = await resendFetch(
        apiKey,
        `/emails/receiving/${encodeURIComponent(emailId)}/attachments?limit=100`,
      )

      if (!response.ok) {
        console.error('[email] 첨부 목록 조회 실패', response.status, await response.text())

        return []
      }

      const body = asRecord(await response.json())
      const rows = Array.isArray(body.data) ? body.data : []

      return rows.flatMap((row) => {
        const record = asRecord(row)

        if (typeof record.id !== 'string') {
          return []
        }

        return [
          {
            id: record.id,
            filename: typeof record.filename === 'string' ? record.filename : 'attachment',
            contentType:
              typeof record.content_type === 'string'
                ? record.content_type.split(';')[0]!.trim().toLowerCase()
                : '',
            size: typeof record.size === 'number' ? record.size : null,
            downloadUrl: typeof record.download_url === 'string' ? record.download_url : null,
          },
        ]
      })
    },

    async send(request) {
      const response = await resendFetch(apiKey, '/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(request.idempotencyKey === null ? {} : { 'Idempotency-Key': request.idempotencyKey }),
        },
        body: JSON.stringify({
          from: request.from,
          to: [request.to],
          subject: request.subject,
          text: request.text,
          ...(request.replyTo === null ? {} : { reply_to: request.replyTo }),
          headers: request.headers,
        }),
      })

      const text = await response.text()

      if (!response.ok) {
        return { ok: false, status: response.status, detail: text.slice(0, 500) }
      }

      let parsed: Record<string, unknown> = {}

      try {
        parsed = asRecord(JSON.parse(text))
      } catch {
        /* 본문이 JSON 이 아니어도 2xx 면 발송은 된 것이다. id 만 잃는다. */
      }

      return { ok: true, providerId: typeof parsed.id === 'string' ? parsed.id : '' }
    },
  }
}
