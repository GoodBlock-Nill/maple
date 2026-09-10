# 이메일 문의 — 활성화 체크리스트

작성 2026-09-09 · 대상: 운영 책임자 · 개발팀 · 설계 문서: `EMAIL-INQUIRY-PLAN.md`

코드·DB·Edge Function 은 모두 **배포된 상태**다. 메일함과 제공자 계정만 아직 없다. 이 문서의 순서대로
하면 "메일 발송 → 콘솔 접수 → 콘솔 답신 → 사용자 회신이 스레드에 붙는" 왕복이 켜진다. 비밀은 전부
Supabase Edge Function secret 에만 들어가고, 관리자 콘솔(Vercel)에는 **새 환경 변수가 없다**.

| 구성 요소                                 | 상태     | 위치                                                            |
| ----------------------------------------- | -------- | --------------------------------------------------------------- |
| DB 마이그레이션                           | 적용됨   | `supabase/migrations/20260909000300_email_inquiries.sql`        |
| 수신 함수 `email-inbound`                 | 배포됨   | `https://<project-ref>.supabase.co/functions/v1/email-inbound`  |
| 발신 함수 `email-outbound`                | 배포됨   | `https://<project-ref>.supabase.co/functions/v1/email-outbound` |
| 관리자 콘솔 고객지원 › 이메일 문의        | 배포됨   | `/inquiries?source=email`                                       |
| 제공자 계정 · 도메인 인증 · 웹훅 · secret | **미완** | 아래 1~6                                                        |

`<project-ref>` 는 `supabase/.temp/project-ref` 또는 Supabase 대시보드의 Project Settings › General 에서 확인한다.

---

## 0. 결정할 것 (기획서 §12)

| 항목                   | 기본 제안                                                         | 결정 |
| ---------------------- | ----------------------------------------------------------------- | ---- |
| 제공자                 | Resend (발신·수신·웹훅 한 계정)                                   |      |
| 발신 주소 `EMAIL_FROM` | `글자월드 고객지원 <support@gjstory.com>`                         |      |
| 회신 도메인            | `in.gjstory.com` (수신 전용 서브도메인, MX 를 Resend 로)          |      |
| 수신 방식              | 1단계: 기존 `contact@` 메일함의 **자동 전달** → 2단계: MX 이전    |      |
| 접수 확인 자동 메일    | 켠다(`EMAIL_INQUIRY_ACK=on`, 발신자당 하루 1회)                   |      |
| 개인정보처리방침 개정  | "이메일 문의 시 수집 항목·보유 기간" 조항 추가 후 Legal 에서 발행 |      |

> `gjstory.com` 은 처음부터 ASCII 도메인이라 DNS·제공자 화면에서 별도 puny 코드 변환 없이 그대로 보인다.

## 1. 메일함 만들기

1. `support@gjstory.com`(발신 주소) 메일함 또는 별칭을 만든다. 답신의 From 이 되고, 사용자가 우리
   답신에 답장하면 Reply-To(`reply+…@in.…`)로 가지만 일부 클라이언트는 From 으로 보내므로 **받을 수
   있는 주소**여야 한다.
2. 이미 있는 `care@gjstory.com` 은 그대로 둔다(사이트 푸터에 노출 중, `site_settings.contact_email`).

## 2. Resend 계정 · 발신 도메인 인증

문서: https://resend.com/docs/add-a-domain · https://resend.com/docs/dashboard/domains/introduction

1. https://resend.com 가입 → Domains › Add Domain → `gjstory.com`(또는 발신 전용 서브도메인).
2. **Records 탭에 나오는 레코드를 그대로** DNS 에 추가한다. 값은 도메인마다 생성되므로 이 문서에 적지
   않는다. 종류는 셋이다.
   - **DKIM** — TXT(또는 CNAME) `resend._domainkey.<도메인>`
   - **SPF** — TXT + MX, Return-Path 서브도메인(기본 `send.<도메인>`)
   - **DMARC** — 인증이 끝난 뒤 Records 탭에 표시된다. `v=DMARC1; p=none;` 로 시작해 안정화 후 `quarantine` 으로 올린다.
3. 대시보드에서 상태가 **Verified** 가 될 때까지 기다린다(전파 수 분~수 시간).

## 3. 수신(Inbound) 켜기

문서: https://resend.com/docs/dashboard/receiving/introduction

1. Emails › **Receiving** 탭. 계정마다 `<id>.resend.app` 수신 서브도메인이 바로 주어진다 — **1단계
   테스트는 이 주소로 충분하다**(`test@<id>.resend.app`).
2. 자체 도메인으로 받으려면 수신 전용 서브도메인 `in.gjstory.com` 의 **MX 레코드**를 Resend 가 안내하는
   값으로 추가한다. 기존 메일함의 MX(`gjstory.com` 루트)는 건드리지 않는다.
3. 회신 주소 형식은 `reply+<24자 hex>@<회신 도메인>` 이다. Resend 수신 도메인은 로컬파트 전체를 받으므로
   별도 캐치올 설정이 필요 없다(운영 중 확인).

## 4. 웹훅 만들기

문서: https://resend.com/docs/dashboard/webhooks/introduction ·
https://resend.com/docs/dashboard/receiving/create-receiving-webhook ·
https://resend.com/docs/dashboard/webhooks/event-types

1. https://resend.com/webhooks → Add Webhook
   - Endpoint URL: `https://<project-ref>.supabase.co/functions/v1/email-inbound`
   - Events: **`email.received`** + 발송 상태 `email.sent` · `email.delivered` · `email.bounced` ·
     `email.failed` · `email.complained` · `email.delivery_delayed`(선택)
2. 만들어진 웹훅의 **Signing Secret**(`whsec_…`)을 복사한다 → 5번의 `RESEND_WEBHOOK_SECRET`.
3. API Keys 에서 **Sending + Receiving 읽기 권한**의 API 키(`re_…`)를 만든다 → `RESEND_API_KEY`.
   수신 웹훅은 메타데이터만 주고 본문은 API 로 다시 읽기 때문에 수신 읽기 권한이 반드시 필요하다.

## 5. Edge Function secret 설정

저장소 루트에서(프로젝트가 `supabase link` 되어 있어야 한다):

```bash
supabase secrets set \
  RESEND_API_KEY='re_xxxxxxxxxxxxxxxxxxxxxxxx' \
  RESEND_WEBHOOK_SECRET='whsec_xxxxxxxxxxxxxxxxxxxxxxxx' \
  EMAIL_FROM='글자월드 고객지원 <support@gjstory.com>' \
  EMAIL_REPLY_DOMAIN='in.gjstory.com' \
  EMAIL_INQUIRY_ACK='on' \
  CLIENT_SITE_URL='https://maple-web-sigma.vercel.app'

supabase secrets list        # 이름만 나온다(값은 보이지 않는다)
```

| secret                  | 필수 | 뜻                                                                                     |
| ----------------------- | ---- | -------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`        | 예   | 수신 본문 조회 + 발송. 없으면 수신은 503(제공자가 재시도), 발송은 503 `not_configured` |
| `RESEND_WEBHOOK_SECRET` | 예   | Svix 서명 키. 없으면 수신 함수는 모든 요청을 503 으로 거절                             |
| `EMAIL_FROM`            | 예   | 답신·접수 확인 메일의 From. `이름 <주소>` 꼴. 인증된 도메인이어야 한다                 |
| `EMAIL_REPLY_DOMAIN`    | 권장 | `reply+<key>@<이 값>`. 비우면 Reply-To 없이 나가고 회신 스레딩은 In-Reply-To 에만 의존 |
| `EMAIL_INQUIRY_ACK`     | 선택 | `on` 이면 접수 확인 메일 발송(발신자당 24시간 1회). 기본 꺼짐                          |
| `CLIENT_SITE_URL`       | 선택 | 접수 확인 메일의 개인정보처리방침 링크(`/policy/privacy`) 기준 주소                    |

`SUPABASE_URL` · `SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` 는 Supabase 가 함수에 자동으로 넣어 준다.
secret 을 바꾼 뒤 재배포는 필요 없다(다음 호출부터 반영).

## 6. 메일함 자동 전달 규칙 (1단계 수신)

`care@gjstory.com` 메일함(Google Workspace 등)의 **자동 전달**을 Resend 수신 주소로 건다.

- 전달 대상: `inbound@<id>.resend.app` 또는 `contact@in.gjstory.com`(3-2 를 했다면)
- "복사본을 받은편지함에 남기기"로 설정한다 — 메일함은 그대로 백업이 된다.
- Google Workspace 는 전달 대상 주소 확인 메일을 보낸다. 그 확인 메일은 Resend 대시보드 Emails › Receiving
  에서 열어 코드를 확인할 수 있다.

**되돌리기 = 이 규칙을 삭제하는 것 하나다.** MX 는 건드리지 않았으므로 메일함은 계속 정상이다.

## 7. 왕복 테스트

1. **수신** — 외부 메일(개인 Gmail 등)에서 `care@gjstory.com` 로 제목·본문·PNG 첨부 1개를 보낸다.
2. 1분 안에 관리자 콘솔 **고객지원 › 이메일 문의** 에 `접수 대기` 로 뜨는지 확인한다.
   - 목록의 계정 칸에 발신자 주소, 상세의 문의 정보에 From · Message-ID · SPF/DKIM/DMARC 칩.
   - 첨부가 `첨부파일` 에 보이면 Storage 업로드까지 정상.
   - 안 뜨면: Resend 대시보드 Webhooks › 해당 엔드포인트의 **Attempts** 에서 응답 코드를 본다.
     `401` 서명 키 불일치, `503` secret 누락, `500` DB 오류(Supabase Edge Functions › Logs).
3. **접수 확인 메일**(켰다면) — 발신자에게 `Re: <제목> [문의 #xxxxxxxx]` 가 도착하고 본문에 방침 링크가 있는지.
4. **답신** — 상세에서 답신을 쓰고 **이메일로 답신 보내기**. 토스트가 뜨고 스레드에 `보낸 답신 · 발송됨` 이 남는다.
   발신자 메일함에 답신이 오는지, From 이 `EMAIL_FROM`, Reply-To 가 `reply+…@` 인지 확인한다.
   - `이메일 발송 설정이 아직 없습니다…` 가 뜨면 5번 secret 을 다시 본다. 답신은 저장돼 있으므로
     설정 후 스레드의 **다시 보내기**로 발송한다.
5. **회신** — 발신자 메일함에서 그 답신에 **답장**을 보낸다. 콘솔 스레드에 `받은 메일` 로 붙고, 상태가
   `답변 완료 → 처리 중` 으로 돌아오는지 확인한다.
6. **발송 실패 표시** — 존재하지 않는 도메인의 주소로 온 테스트 문의에 답신하면 `email.bounced` 웹훅이
   `실패` 칩과 **다시 보내기** 버튼을 만든다.

## 8. 운영 중 확인 포인트

- 함수 로그: Supabase 대시보드 › Edge Functions › `email-inbound` / `email-outbound` › Logs.
  원문 오류는 여기에만 남고 콘솔에는 고정 문구만 보인다(DEVELOPER-GUIDE §7).
- 웹훅 재시도: Resend 는 2xx 가 아니면 5초 · 5분 · 30분 · 2시간 · 5시간 · 10시간 뒤 재시도한다. 같은 전달은
  `email_inbound_events` 로 한 번만 처리되고, 같은 메일은 `Message-ID` 유니크로 두 번 접수되지 않는다.
- 발신자별 시간당 20건을 넘으면 `종료` 상태 + 본문 머리에 `[자동 종료: 과다 수신]` 으로 접수된다.
- 자동응답·뉴스레터·배달 실패 보고·`no-reply@` 발신은 저장하지 않는다(200 으로 끝). 정상 문의가 걸렸다는
  민원이 오면 `supabase/functions/_shared/email/loop-guard.ts` 의 규칙을 본다.
- Resend 무료 구간: 월 3,000건 · 일 100건 · 도메인 3개(https://resend.com/pricing). 수신이 같은 한도를
  쓰는지는 문서에 명시돼 있지 않다 — 대시보드 사용량을 첫 달에 확인한다.

## 9. 되돌리기

| 단계                  | 되돌리기                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| 수신 중단             | 메일함 자동 전달 규칙 삭제(6). MX 를 옮겼다면 MX 원복                                              |
| 웹훅만 중단           | Resend Webhooks 에서 엔드포인트 비활성화, 또는 `supabase secrets unset RESEND_WEBHOOK_SECRET`(503) |
| 발송 중단             | `supabase secrets unset RESEND_API_KEY` — 콘솔 답신은 저장되고 `다시 보내기` 로 나중에 발송        |
| 접수 확인 메일만 중단 | `supabase secrets set EMAIL_INQUIRY_ACK=off`                                                       |

이미 접수된 이메일 문의는 1:1 문의와 같은 보유·파기 기준을 따른다(기획서 §8).

## 10. 근거 문서 (2026-09-09 확인)

구현이 의존한 Resend 공식 문서와, 문서에 없어 **관용적으로 처리한 부분**.

| 확인한 사실                                                                                                                                                                | 출처                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 수신 이벤트 이름은 `email.received`; 발송 이벤트는 `email.sent` `delivered` `delivery_delayed` `complained` `bounced` `failed` `opened` `clicked` `scheduled` `suppressed` | https://resend.com/docs/dashboard/webhooks/event-types                                                                |
| 수신 웹훅 `data` 에는 `email_id` `from` `to` `cc` `bcc` `received_for` `message_id` `subject` `attachments[{id,filename,content_type}]` 만 있고 **본문·헤더는 없다**       | https://resend.com/docs/dashboard/receiving/create-receiving-webhook                                                  |
| 전체 메일은 `GET /emails/receiving/{email_id}` — `text` `html` `headers`(객체) `message_id` `attachments[…size]`                                                           | https://resend.com/docs/api-reference/emails/retrieve-received-email                                                  |
| 첨부는 `GET /emails/receiving/{email_id}/attachments` → `download_url` + `expires_at`(만료되는 주소)                                                                       | https://resend.com/docs/api-reference/emails/list-received-email-attachments                                          |
| 서명 헤더 `svix-id` `svix-timestamp` `svix-signature`(`v1,<base64>` 여러 개 가능), 원문 body 로 검증                                                                       | https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests                                                   |
| 서명 = HMAC-SHA256(`whsec_` 뒤 base64 키, `${id}.${timestamp}.${body}`)                                                                                                    | https://docs.svix.com/receiving/verifying-payloads/how-manual (Resend 문서가 안내하는 페이지)                         |
| 발송 `POST /emails`: `from` `to` `subject` `text` `reply_to` `headers`(In-Reply-To · References 가능) `Idempotency-Key`, 응답 `{ id }` 동기                                | https://resend.com/docs/api-reference/emails/send-email · https://resend.com/docs/dashboard/receiving/reply-to-emails |
| 요청에 `User-Agent` 가 없으면 403, 기본 10 req/s                                                                                                                           | https://resend.com/docs/api-reference/introduction                                                                    |
| 웹훅은 at-least-once(중복 가능), 재시도 5초·5분·30분·2시간·5시간·10시간                                                                                                    | https://resend.com/docs/dashboard/webhooks/introduction                                                               |
| 자체 도메인 수신에는 MX 레코드가 필요, 테스트용 `<id>.resend.app` 제공                                                                                                     | https://resend.com/docs/dashboard/receiving/introduction                                                              |

| 문서에 없어 관용적으로 처리한 것           | 구현                                                                                                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SPF/DKIM/DMARC 판정 필드                   | `Authentication-Results` 헤더에서 `spf=` `dkim=` `dmarc=` 를 읽는다. 제공자가 `spf`/`dkim`/`dmarc` 필드를 주면 그것을 우선. 없으면 null(뱃지 없음)             |
| 타임스탬프 허용 창                         | 5분(우리 결정). Svix 문서는 "허용 범위를 두라"고만 한다                                                                                                        |
| 발송 응답 `id` 와 RFC `Message-ID` 의 관계 | 답신 행에는 발송 `id` 를 저장(발송 이벤트가 `email_id` 로 온다). 회신 스레딩은 `reply+key` 가 1차, In-Reply-To 매칭은 `id`·`<id@…>`·로컬파트 세 꼴을 모두 시도 |
| 웹훅에 본문이 인라인으로 실리는 경우       | `text`/`html` 이 있으면 API 조회 없이 그대로 쓴다(제공자 변경·타 제공자 대비)                                                                                  |
| 첨부 허용 목록                             | 버킷 `inquiry-attachments` 의 allowed_mime_types 와 같은 7종(png · jpeg · gif · webp · pdf · zip · txt)                                                        |
| 수신이 무료 한도를 공유하는지              | 미확인. 첫 달 사용량 확인                                                                                                                                      |
