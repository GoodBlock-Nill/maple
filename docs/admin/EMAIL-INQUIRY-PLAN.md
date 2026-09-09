# 이메일 문의 처리 — 설계 · 구현 기획

작성 2026-09-09 · 상태: 기획(구현 전) · 대상: 관리자 콘솔 고객지원 모듈

## 1. 배경과 목표

사용자 사이트 푸터에는 연락 이메일(`site_settings.contact_email`, 현재 `contact@글자월드.co.kr`)이 노출된다. 1:1 문의 폼을 거치지 않고 **이메일로 바로 들어오는 문의**를 운영자가 메일함과 관리자 콘솔을 번갈아 보며 처리하고 있어, 고객지원 메뉴 안에서 같은 방식으로 처리하게 해 달라는 피드백이 있었다.

목표는 셋이다.

1. 이메일로 온 문의가 **관리자 콘솔 고객지원 메뉴**에 1:1 문의와 같은 모양으로 쌓인다.
2. 운영자가 콘솔에서 답신을 쓰면 **이메일로 발송**되고, 답변 이력이 같은 화면에 남는다.
3. 사용자가 그 답신에 **다시 회신**하면 같은 문의 스레드에 붙는다.

제약은 "최대한 심플하고 안전하게"다. 새 인프라·새 서비스는 하나까지만 두고, 기존 1:1 문의 테이블·화면·권한·감사 로그를 그대로 재사용한다.

## 2. 접근 방식 비교

| 방식                                                                                | 구조                                                  | 장점                                                            | 단점 · 위험                                                                                 |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **A. 이메일 제공자 수신 웹훅** (Resend Inbound · Postmark Inbound · SendGrid Parse) | 메일 → 제공자 → HTTPS 웹훅 → 우리 함수 → DB           | 파싱·첨부·SPF/DKIM 판정을 제공자가 해 줌. 서명 검증 하나로 안전 | 도메인 MX 를 제공자로 바꾸거나 전달 설정 필요                                               |
| B. Cloudflare Email Routing + Worker                                                | MX 를 Cloudflare 로 → Worker 가 파싱해 우리 함수 호출 | 무료, DNS 가 이미 Cloudflare 면 간단                            | MIME 파싱을 우리가 짊어짐(라이브러리 필요), DNS 가 Cloudflare 가 아니면 이전 작업이 선행    |
| C. IMAP 폴링                                                                        | 크론 함수가 메일함을 주기적으로 읽음                  | DNS 변경 없음                                                   | 메일함 비밀번호/앱 비밀번호를 서버에 보관, 중복·유실 처리·MIME 파싱 전부 우리 몫. 가장 취약 |
| D. 수동 등록                                                                        | 운영자가 메일 내용을 폼에 붙여 넣음                   | 개발 최소                                                       | 자동화 없음. 답신도 메일함에서 따로 보내야 함                                               |

**권장: A.** 이유는 두 가지다.

- 관리자 초대·비밀번호 재설정 메일을 위해 어차피 **커스텀 SMTP(발신 제공자)** 를 연결해야 한다(`admin/README.md` §5). 같은 제공자에서 수신(Inbound)까지 쓰면 새로 계약·관리할 서비스가 늘지 않는다.
- 웹훅은 **서명 검증 하나**로 인증이 끝나고, 스팸·인증 판정(SPF/DKIM/DMARC)과 첨부 파싱을 제공자가 해 준다. 우리가 보관하는 비밀은 웹훅 서명 키와 API 키 둘뿐이다.

제공자는 **Resend** 를 1순위로 둔다(발신·수신·SMTP 릴레이 제공, 무료 구간 월 3,000건, 웹훅은 Svix 표준 서명). Postmark 는 수신이 성숙하지만 발신 요금이 별도라 2순위다. 최종 선택은 개발팀이 계정 정책에 맞춰 정한다 — 아래 설계는 제공자에 의존하지 않도록 **어댑터 한 파일**에 제공자 차이를 가둔다.

### MX 를 바꾸지 않고 시작하는 방법 (권장 1단계)

`contact@글자월드.co.kr` 이 지금 Google Workspace 같은 메일함이라면 MX 를 바꾸는 순간 그 메일함에는 메일이 오지 않는다. 그래서 1단계에서는 **메일함의 자동 전달(forwarding) 규칙**으로 제공자의 수신 주소(예: `inbound@in.글자월드.co.kr` 또는 제공자가 주는 수신 주소)로 복사본을 보내게 한다. DNS 는 발신용 SPF/DKIM 레코드만 추가하면 되고, 기존 메일함은 그대로 남아 **되돌리기도 규칙 삭제 한 번**이다. 안정화된 뒤 MX 이전을 검토한다.

## 3. 전체 흐름

```mermaid
flowchart LR
    U[사용자 메일] -->|contact@ 로 발송| MB[기존 메일함]
    MB -->|자동 전달| IN[제공자 수신 주소]
    IN -->|웹훅 POST + 서명| EF[Supabase Edge Function<br/>email-inbound]
    EF -->|서명 검증 · 중복 제거 · 정제| DB[(inquiries<br/>source = email)]
    EF -->|첨부 저장| ST[(Storage<br/>inquiry-attachments)]
    DB --> ADM[관리자 콘솔<br/>고객지원 › 이메일 문의]
    ADM -->|답신 저장 + 발송 API| OUT[제공자 발신]
    OUT -->|Reply-To: reply+id@| U
    U -->|회신| IN
```

수신·발신 모두 **서비스 롤은 Edge Function 안에서만** 쓴다. 관리자 콘솔은 기존대로 세션 클라이언트 + RLS 로 읽고 쓴다.

## 4. 데이터 모델 변경 (마이그레이션 1개)

기존 `inquiries` · `inquiry_replies` 를 그대로 쓰고 열 몇 개를 더한다. 별도 테이블을 만들지 않는 이유: 목록·상세·상태 전이·권한·감사 로그가 이미 1:1 문의에 다 있고, 운영자가 두 종류를 한 화면에서 같은 규칙으로 처리해야 한다.

```sql
-- inquiries
alter table public.inquiries
  add column source text not null default 'web'
    check (source in ('web', 'email')),
  add column email_from text,                 -- 발신자 주소(표시용, 회신 대상)
  add column email_from_name text,
  add column email_message_id text,           -- 원본 Message-ID (중복 수신 방지)
  add column email_auth jsonb,                -- { spf, dkim, dmarc } 제공자 판정 그대로
  add column email_thread_key text;           -- reply+<key>@ 에 쓰는 무작위 토큰

create unique index inquiries_email_message_id_key
  on public.inquiries (email_message_id) where email_message_id is not null;
create unique index inquiries_email_thread_key_key
  on public.inquiries (email_thread_key) where email_thread_key is not null;

-- 이메일 문의는 폼의 체크박스를 거치지 않는다. 동의는 접수 확인 메일의 고지로 대체한다(§8).
alter table public.inquiries drop constraint inquiries_privacy_consent_required;
alter table public.inquiries add constraint inquiries_privacy_consent_required
  check (privacy_consent or source = 'email');

-- inquiry_replies: 방향과 메일 식별자
alter table public.inquiry_replies
  add column direction text not null default 'outbound'
    check (direction in ('outbound', 'inbound')),
  add column email_message_id text,
  add column delivery_status text            -- queued | sent | failed (발신만)
    check (delivery_status is null or delivery_status in ('queued','sent','failed'));
```

- `category` 는 `'email'`, `type` 은 `'general'` 로 고정 저장한다(두 열이 `not null`). 화면에서는 "이메일" 뱃지로 보인다.
- `user_id` 는 null. 발신자 주소가 가입 회원의 이메일과 같으면 **연결하지 않는다** — 메일 주소는 위조 가능하므로 회원 식별 근거로 쓰지 않는다.
- `attachments` 는 기존 jsonb 형식(`{ name, path, size, mimeType }`)을 그대로 쓴다. 3개 제약도 유지(초과분은 버리고 본문 끝에 "첨부 N개 중 3개만 저장" 표기).
- RLS: `inquiries_select_admin` · `inquiry_replies_admin_all` 이 이미 관리자 읽기·쓰기를 연다. 새 열에 추가 정책은 필요 없다. 웹훅의 insert 는 서비스 롤이라 정책을 타지 않는다.
- 사용자 사이트의 "내 문의 내역"은 `user_id` 로 조회하므로 이메일 문의는 **표시되지 않는다**(의도된 동작).

## 5. 수신 파이프라인 — `supabase/functions/email-inbound`

Edge Function 하나. Next 라우트 대신 Edge Function 을 쓰는 이유: 서비스 롤 키를 Vercel 함수가 아닌 Supabase 경계 안에 두고, 사용자 사이트·관리자 배포와 수명이 분리된다.

처리 순서(각 단계에서 실패하면 그 사유로 4xx/5xx 를 돌려 제공자가 재시도하게 둔다):

1. **서명 검증** — 제공자 표준(Svix: `svix-id` · `svix-timestamp` · `svix-signature`, HMAC-SHA256). 타임스탬프가 5분 이상 벗어나면 거절(재전송 공격 차단). 서명 키는 함수 secret.
2. **중복 제거** — `email_message_id` 유니크 인덱스에 걸리면 200 으로 조용히 종료(제공자 재시도가 중복 문의를 만들지 않게).
3. **루프 방지** — `Auto-Submitted: auto-*`, `Precedence: bulk|junk|list`, `X-Autoreply`, 또는 발신자가 우리 발신 주소면 저장하지 않고 200.
4. **스레드 판정** — 수신 주소가 `reply+<thread_key>@…` 이거나 `In-Reply-To` 가 우리가 보낸 `email_message_id` 와 일치하면 **기존 문의의 inbound 답글**로 붙이고, 상태를 `answered → in_progress` 로 되돌린다(운영자가 다시 볼 수 있게). 아니면 새 문의.
5. **본문 정제** — `text/plain` 을 우선 저장. `text/html` 만 있으면 기존 `lib/sanitize` 계열과 같은 허용 목록으로 정제한 뒤 텍스트로 변환해 `content` 에 넣는다(콘솔은 평문으로 그린다). 본문 상한 20,000자, 초과분은 잘라 표기.
6. **첨부** — 허용 MIME(이미지·PDF·zip·txt)과 크기(개당 10MB, 최대 3개)만 `inquiry-attachments/email/<inquiry_id>/…` 에 저장. 실행 파일·HTML·스크립트 계열은 버리고 본문 끝에 "제외된 첨부: 파일명" 을 남긴다.
7. **인증 판정 저장** — 제공자가 준 SPF/DKIM/DMARC 결과를 `email_auth` 에 그대로 넣는다. **차단하지 않는다** — 정상 문의도 DMARC 를 통과하지 못하는 경우가 흔하다. 콘솔에서 "인증 실패" 뱃지로만 알린다.
8. **접수 확인 메일**(선택, 기본 on) — "문의가 접수되었습니다. 답변은 이 메일에 회신됩니다." + 개인정보 처리 고지 링크. 이 메일은 **하루 같은 발신자에게 1회**만(루프·폭탄 방지).
9. **레이트 리밋** — 같은 발신자 주소로 시간당 20건 초과 시 저장은 하되 `status='closed'` 로 접수하고 "자동 종료(과다 수신)" 사유를 남긴다. 운영자가 목록에서 걸러 볼 수 있다.

## 6. 발신 — 콘솔 답신

기존 `replyToInquiryAction`(`admin/lib/actions/inquiries-actions.ts`)을 확장한다.

- `source = 'email'` 인 문의에서 답신을 저장하면 **같은 트랜잭션 안에서** `inquiry_replies` 에 `direction='outbound', delivery_status='queued'` 로 넣고, 발송은 Edge Function `email-outbound` 를 호출해 처리한다(관리자 서버 액션이 제공자 API 키를 들고 있지 않게).
- 발신 헤더: `From: 글자월드 고객지원 <support@글자월드.co.kr>`, `Reply-To: reply+<thread_key>@<수신 도메인>`, `In-Reply-To`/`References` 에 원본 `Message-ID`. 제목은 `Re: <원제목> [문의 #<짧은 id>]`.
- 발송 결과(성공/실패)는 웹훅(`email.sent` · `email.bounced` 등)으로 받아 `delivery_status` 를 갱신한다. 실패는 콘솔 스레드에 "발송 실패 — 다시 보내기" 로 보인다.
- 답신 저장 시 상태 전이는 1:1 문의와 동일(`answered`). 감사 로그는 `inquiry.email.reply` 로 남긴다.

## 7. 관리자 콘솔 변경 (고객지원 모듈, 권한 `inquiries`)

- **사이드바**: 고객지원 › `1:1 문의` · `이메일 문의` · `FAQ`. `이메일 문의` 는 `/inquiries?source=email` 로 가는 필터 프리셋이다(새 라우트를 만들지 않는다).
- **목록**(`InquiryFilters`): 출처 필터(웹/이메일) 추가, 이메일 행에는 발신자 주소와 "인증 실패" 뱃지 표시. 검색은 발신자 주소도 대상.
- **상세**(`InquiryMeta` · `InquiryReplyThread`): 출처가 이메일이면 계정 ID 대신 `From`/제목/수신 시각/SPF·DKIM 결과를 보이고, 스레드는 방향(받음/보냄)을 좌우 정렬과 뱃지로 구분. 발송 상태(대기·발송됨·실패)를 답글 옆에 표시.
- **답신 폼**(`InquiryReplyForm`): 이메일 문의에서는 버튼 문구를 "이메일로 답신 보내기" 로, 힌트에 "사용자의 메일 주소로 발송됩니다. 개인정보나 계정 정보는 적지 마세요." 를 둔다. 글자수 카운터는 기존 2,000자 규칙 유지.
- **상태·종료·취소**: 1:1 문의와 동일. 이메일 문의의 "접수 취소"는 사용자가 할 수 없으므로 표시하지 않는다.
- 문구·오류 처리·확인 모달은 개발자 가이드 §7 규약을 따른다. 원문 제공자 오류는 로그에만.

## 8. 보안 · 개인정보

| 위험                    | 대응                                                                                                                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 위조 웹훅               | Svix 서명 + 타임스탬프 5분 창. 서명 키는 함수 secret, 코드·저장소에 두지 않음                                                                                                                                              |
| 재전송·중복             | `email_message_id` 유니크. 같은 메일은 두 번 저장되지 않음                                                                                                                                                                 |
| 메일 폭탄·루프          | 자동응답 헤더 무시, 발신자별 시간당 상한, 접수 확인 메일 1일 1회, 우리 발신 주소로부터의 메일 무시                                                                                                                         |
| 악성 첨부·HTML          | MIME 허용 목록, 크기 상한, HTML 은 정제 후 텍스트화. 콘솔은 항상 평문 렌더                                                                                                                                                 |
| 발신자 위조로 회원 사칭 | 메일 주소를 회원 식별에 쓰지 않음(`user_id` 항상 null). 답신에 계정 정보를 적지 말라는 힌트                                                                                                                                |
| 서비스 롤 노출          | 서비스 롤·API 키는 Edge Function 안에서만. 관리자 서버 액션은 함수 호출만                                                                                                                                                  |
| 개인정보 수집 근거      | 이메일 문의는 폼 동의 체크박스가 없으므로 **개인정보처리방침에 "이메일 문의 시 수집 항목(주소·이름·본문·첨부)과 보유 기간" 조항을 추가**하고, 접수 확인 메일에 방침 링크를 넣는다. 관리자 Legal 모듈에서 개정본을 발행한다 |
| 보유 기간               | 1:1 문의와 같은 기준 적용(방침 제4조). 종료 후 N년 경과분은 기존 파기 절차에 포함                                                                                                                                          |
| 발신 도메인 신뢰        | SPF·DKIM·DMARC 레코드 등록. 미등록 시 답신이 스팸함으로 가서 "답이 안 온다"는 민원이 된다                                                                                                                                  |

## 9. 운영 설정 체크리스트 (개발 착수 전 결정·준비)

1. 제공자 선택과 계정(권장 Resend). 발신 도메인(`글자월드.co.kr`) 인증 — DNS 에 DKIM·SPF·DMARC 레코드. IDN 도메인은 puny 코드(`xn--bj0b33kj0qqva.co.kr`)로 등록됨을 확인.
2. 수신 방식 결정: **메일함 자동 전달**(권장 1단계) 또는 MX 이전. 전달이면 메일함 관리자가 규칙을 만든다.
3. 발신 주소 확정(예: `support@글자월드.co.kr`)과 회신 도메인(`reply+…@` 를 받을 도메인, 제공자 수신 주소일 수 있음).
4. Supabase Edge Function secret 3개: 제공자 API 키, 웹훅 서명 키, 서비스 롤 키(함수는 기본 제공).
5. 개인정보처리방침 개정 초안(§8) — Legal 모듈로 발행.
6. 접수 확인 메일 문안 확정(1건).

## 10. 구현 단계와 예상 규모

| 단계                      | 내용                                                                                                                                                 | 규모  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| **1. 수신 + 목록 + 답신** | 마이그레이션, `email-inbound` 함수(서명·중복·정제·첨부), 사이드바 프리셋·목록 필터·상세 표시, `email-outbound` 함수와 답신 액션 확장, 발송 상태 웹훅 | 2일   |
| **2. 스레딩**             | `reply+key` 수신 → inbound 답글 붙이기, 상태 되돌림, 스레드 방향 UI                                                                                  | 0.5일 |
| **3. 안전장치·운영**      | 접수 확인 메일, 발신자 레이트 리밋, 인증 실패 뱃지, 감사 로그·문구 정리, 방침 개정 발행                                                              | 0.5일 |
| 테스트                    | 함수 단위 테스트(서명 검증·중복·루프·정제·첨부 필터), 관리자 액션 테스트(출처별 분기·발송 실패 표시), 실제 메일 왕복 E2E(제공자 테스트 계정)         | 포함  |

기존 코드 재사용 비율이 높아 새로 만드는 것은 Edge Function 2개, 마이그레이션 1개, 컴포넌트 수정 5개 안쪽이다.

## 11. 하지 않기로 한 것

- **콘솔 안 메일함 만들기**(모든 메일 동기화) — 문의가 아닌 메일까지 관리자 DB 에 들어온다. 문의로 접수된 것만 다룬다.
- **자동 분류·자동 답변** — 오답이 곧 민원이다. 운영자가 읽고 답한다.
- **발신자 이메일로 회원 자동 연결** — 사칭 위험(§8).
- **IMAP 폴링** — 비밀번호 보관과 파싱 부담이 크고, 제공자 웹훅이 같은 일을 더 안전하게 한다.

## 12. 열린 질문 (개발 착수 전 답이 필요)

1. `contact@글자월드.co.kr` 은 현재 어떤 메일함인가(Google Workspace / 호스팅 메일 / 전달 전용)? 자동 전달 규칙을 만들 수 있는가?
2. DNS 관리 주체는 누구인가(레코드 추가 권한)?
3. 답신 발신 주소를 `contact@` 그대로 쓸지, `support@` 를 새로 둘지.
4. 접수 확인 자동 메일을 보낼지(기본 제안: 보낸다, 하루 1회).
5. 제공자를 Resend 로 확정해도 되는지(관리자 초대 SMTP 와 통합).
