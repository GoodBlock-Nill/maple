/**
 * Edge Function 환경 변수. Deno 전용(루트 tsc 는 이 폴더를 보지 않는다).
 *
 * SUPABASE_URL · SUPABASE_ANON_KEY · SUPABASE_SERVICE_ROLE_KEY 는 Supabase 가 자동으로 넣어 준다.
 * 나머지는 `supabase secrets set` 으로 넣는다(docs/admin/EMAIL-INQUIRY-ACTIVATION.md).
 */

export function readEnv(name: string): string | null {
  const value = Deno.env.get(name)

  return value === undefined || value.trim() === '' ? null : value.trim()
}

export function requireEnv(name: string): string {
  const value = readEnv(name)

  if (value === null) {
    throw new Error(`환경 변수 ${name} 가 비어 있습니다.`)
  }

  return value
}

export type EmailEnv = {
  resendApiKey: string | null
  webhookSecret: string | null
  /** `글자월드 고객지원 <support@…>` 꼴. 발신 From. */
  from: string | null
  /** `reply+<key>@<이 값>` 을 받을 도메인. */
  replyDomain: string | null
  /** 접수 확인 메일 on/off. 기본 off — 켜는 것은 운영 결정(기획서 §12-4). */
  ackEnabled: boolean
  clientSiteUrl: string
}

export function readEmailEnv(): EmailEnv {
  return {
    resendApiKey: readEnv('RESEND_API_KEY'),
    webhookSecret: readEnv('RESEND_WEBHOOK_SECRET'),
    from: readEnv('EMAIL_FROM'),
    replyDomain: readEnv('EMAIL_REPLY_DOMAIN'),
    ackEnabled: readEnv('EMAIL_INQUIRY_ACK') === 'on',
    clientSiteUrl: (readEnv('CLIENT_SITE_URL') ?? 'https://maple-web-sigma.vercel.app').replace(
      /\/+$/,
      '',
    ),
  }
}
