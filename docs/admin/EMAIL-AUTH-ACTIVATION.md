# 이메일 로그인·회원가입 — 활성화 체크리스트

작성 2026-09-10 · 대상: 운영 책임자 · 개발팀 · 관련 화면: `/login` · `/signup` · `/forgot-password` · `/reset-password`

화면과 서버 액션은 **배포된 상태**다. 남은 것은 Supabase 프로젝트 설정 두 가지뿐이다 —
**① 인증번호 자릿수·메일 템플릿을 원격에 밀어 넣기, ② 실제로 메일이 나가게 하기(SMTP).**
이 두 가지를 하기 전에는 회원가입 1단계("인증번호 전송")가 실패한다.

| 구성 요소                               | 상태       | 위치                                                                 |
| --------------------------------------- | ---------- | -------------------------------------------------------------------- |
| 로그인·회원가입·비밀번호 화면           | 배포됨     | `app/(auth)/**`, `components/auth/**`                                |
| 서버 액션(로그인 · 인증번호 · 비밀번호) | 배포됨     | `lib/actions/email-auth-actions.ts`, `lib/actions/signup-actions.ts` |
| 메일 링크 검증 라우트                   | 배포됨     | `app/auth/confirm/route.ts`                                          |
| `otp_length = 6` · 메일 템플릿 3종      | **미반영** | `supabase/config.toml`, `supabase/templates/*.html` → 아래 1         |
| 실제 메일 발송(커스텀 SMTP)             | **미완**   | 아래 2~4                                                             |

---

## 0. 지금 그대로 두면 무슨 일이 생기나

| 증상                                              | 원인                                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------------- |
| 인증번호를 받아도 "인증하기" 버튼이 켜지지 않는다 | 원격 프로젝트의 `otp_length` 가 아직 **8** 이다. 화면은 6자리를 받는다 |
| "인증번호 요청이 너무 잦습니다" 가 곧바로 뜬다    | 기본 메일러의 발송 한도가 **시간당 2통**이다                           |
| 팀 멤버가 아닌 주소로는 메일이 오지 않는다        | Supabase 기본 메일러는 **프로젝트 팀 멤버 주소에만** 보낸다            |
| "사용할 수 없는 이메일 주소입니다" 가 뜬다        | `.local` · `example.com` 같은 예약 도메인은 Auth 가 거절한다           |

## 1. `supabase config push` — 인증번호 자릿수와 메일 본문 반영

이 저장소의 `supabase/config.toml` 에는 이번 작업으로 다음이 들어갔다.

- `[auth.email] otp_length = 6` — 화면의 "인증번호 6자리" 와 맞춘다(`lib/validation/email-auth.ts`).
- `[auth.email.template.confirmation|magic_link|recovery]` — 한글 본문 3종(`supabase/templates/`).
  세 템플릿 모두 **인증번호(`{{ .Token }}`)를 가장 크게** 싣고, 보조로 `/auth/confirm?token_hash=…`
  링크와 `{{ .ConfirmationURL }}` 을 함께 둔다.

```bash
# 프로젝트가 연결돼 있는지 확인 (supabase/.temp/project-ref)
supabase projects list

# 반영 — [auth] 섹션 전체가 원격에 그대로 덮인다
supabase config push
```

> **주의**: `config push` 는 `[auth]` 섹션을 **통째로** 밀어 넣는다. `site_url`,
> `additional_redirect_urls`, `enable_anonymous_sign_ins`, `enable_confirmations` 도 함께 반영된다.
> 대시보드에서 손으로 바꿔 둔 값이 있으면 되돌아가므로, 실행 전에 `config.toml` 의 `[auth]` 가
> 현재 운영 값과 같은지 훑어본다.

반영 확인:

```bash
# 인증번호가 6자리로 바뀌었는지 — 팀 멤버 주소로 실제 메일을 받아 확인하거나,
# 서비스 롤 키로 링크를 생성해 확인한다(메일은 나가지 않는다).
node -e "
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
s.auth.admin.generateLink({ type: 'magiclink', email: 'qa+otp@글자월드.co.kr' })
 .then(r => console.log(r.data?.properties?.email_otp?.length, r.error?.message));
"
```

## 2. 왜 커스텀 SMTP 가 필요한가

Supabase 기본 메일러는 **개발용**이다. 문서: https://supabase.com/docs/guides/auth/auth-smtp

- 수신자가 **프로젝트 팀 멤버(Organization member) 주소로 제한**된다. 일반 가입자에게는 아예 가지 않는다.
- 발송 한도가 **시간당 2통**이다(`[auth.rate_limit] email_sent = 2`).
- 이 한도는 커스텀 SMTP 를 붙여야 올릴 수 있다.

즉 **커스텀 SMTP 없이는 이메일 회원가입을 오픈할 수 없다.**

## 3. Resend SMTP 연결

이미 이메일 문의(`docs/admin/EMAIL-INQUIRY-ACTIVATION.md`)에서 Resend 도메인 인증을 했다면 그 도메인을
그대로 쓴다. 발신 주소만 인증용으로 하나 더 정하면 된다(예: `no-reply@글자월드.co.kr`).

### 3-1. 대시보드에서 켜기 (권장 — 비밀이 저장소에 남지 않는다)

1. Resend → API Keys → **Sending access** 권한으로 키 발급.
2. Supabase 대시보드 → **Authentication → Emails → SMTP Settings** → _Enable Custom SMTP_.
3. 값 입력:

   | 항목         | 값                                           |
   | ------------ | -------------------------------------------- |
   | Host         | `smtp.resend.com`                            |
   | Port         | `465` (TLS) 또는 `587`                       |
   | Username     | `resend`                                     |
   | Password     | Resend API 키                                |
   | Sender email | `no-reply@글자월드.co.kr` (인증 완료 도메인) |
   | Sender name  | `글자월드`                                   |

4. 저장 후 **Rate Limits** 탭에서 `Emails sent per hour` 를 올린다(초기 운영 기준 100~300 권장).

> 대시보드에서 SMTP 를 켰다면 `config.toml` 의 `[auth.email.smtp]` 는 **주석 상태로 둔다**. 주석인 채로
> `config push` 를 하면 SMTP 설정이 꺼질 수 있으므로, 아래 3-2 처럼 파일에도 함께 적어 두는 편이 안전하다.

### 3-2. `config.toml` 에 적어 두기 (CLI 일원화)

```toml
[auth.email.smtp]
enabled = true
host = "smtp.resend.com"
port = 465
user = "resend"
pass = "env(RESEND_SMTP_PASSWORD)"
admin_email = "no-reply@xn--o39an51b2pfban6f.co.kr"  # 글자월드.co.kr
sender_name = "글자월드"

[auth.rate_limit]
email_sent = 100
```

- `pass = "env(...)"` 는 **셸 환경 변수**를 읽는다. 키를 파일에 직접 적지 않는다.
  `RESEND_SMTP_PASSWORD=re_xxx supabase config push` 처럼 실행한다.
- IDN 도메인은 puny 코드(`xn--…`)로 적는 편이 안전하다.

## 4. 스팸함 대비

- Resend 도메인의 **SPF · DKIM · DMARC** 가 Verified 인지 확인한다(문의 메일과 같은 도메인이면 이미 끝났다).
- 발신 주소는 실제로 받을 수 있는 주소이거나, 최소한 반송을 버리지 않는 주소여야 한다.

---

## 5. 테스트 절차

### 5-1. 회원가입(인증번호)

1. `/signup` 에서 **팀 멤버 주소**(또는 SMTP 연결 후에는 아무 주소)를 넣고 "인증번호 전송".
2. "인증번호를 보냈습니다. 메일함을 확인해 주세요." 가 뜨고 버튼이 `60초 후 재전송` 으로 바뀐다.
3. 메일의 6자리 번호를 넣고 "인증하기" → 버튼이 "인증 완료" 로 바뀐다.
4. 비밀번호(영문+숫자 8자 이상)를 두 번 넣고 "가입하기" → `/auth/onboarding` 으로 넘어간다.
5. 닉네임·약관 동의를 마치면 원래 가려던 곳으로 돌아간다.

### 5-2. 메일 없이 확인하기 (개발·QA)

서비스 롤 키로 링크를 생성하면 **메일을 보내지 않고** 같은 인증번호를 얻을 수 있다.
`properties.email_otp` 가 메일에 실릴 번호다.

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const email = 'qa-signup-' + Date.now() + '@글자월드.co.kr';
s.auth.admin.generateLink({ type: 'magiclink', email }).then(r =>
  console.log(email, r.data?.properties?.email_otp, r.error?.message));
"
```

- 이 번호를 `/signup` 의 인증번호 칸에 넣으면 실제 화면 흐름을 그대로 확인할 수 있다.
- 끝나면 계정을 지운다: `auth.admin.deleteUser(id)` + `profiles` 행 삭제(테스트 계정만).
- **주의**: 예약 도메인(`*.local`, `example.com`)은 Auth 가 거절한다. 실재하는 도메인을 쓴다.

### 5-3. 비밀번호 로그인 · 찾기

1. `/login` — 두 칸을 채우기 전에는 버튼이 25% 로 잠겨 있다.
2. 틀린 비밀번호 → "이메일 또는 비밀번호가 올바르지 않습니다."
3. `/forgot-password` → 주소 입력 → 가입 여부와 무관하게 같은 안내가 뜬다(계정 열어보기 방지).
4. 메일의 버튼 → `/auth/confirm?token_hash=…&type=recovery&next=/reset-password` → 새 비밀번호 저장 →
   자동 로그아웃 → `/login?notice=password_updated` 에 "비밀번호가 변경되었습니다." 가 뜬다.

---

## 6. 문제 해결

| 메시지 / 증상                            | 원인 · 조치                                                                      |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| `인증번호 요청이 너무 잦습니다`          | 시간당 발송 한도(기본 2). SMTP 연결 후 `email_sent` 를 올린다                    |
| `사용할 수 없는 이메일 주소입니다`       | 예약 도메인(`.local`, `example.com`) 또는 차단 목록. 다른 주소로 시도            |
| `이미 가입된 이메일입니다`               | 메일 인증까지 마친 계정이거나 탈퇴 대기 계정. `/login` 또는 비밀번호 찾기로 안내 |
| `이메일 인증이 완료되지 않은 계정입니다` | 인증번호 단계를 마치지 않고 비밀번호만 만든 계정. 회원가입에서 인증을 마친다     |
| 인증번호를 넣어도 "인증하기" 가 안 켜짐  | 원격 `otp_length` 가 6이 아니다 → 1번(`config push`) 을 먼저 한다                |
| 메일이 오지 않는다                       | 기본 메일러는 팀 멤버 주소만. Auth Logs(대시보드 → Logs → Auth)에서 실패 확인    |

## 7. 되돌리기

- 이메일 가입을 잠시 막으려면 `[auth.email] enable_signup = false` 후 `config push`.
  화면은 그대로 뜨지만 인증번호 요청이 "지금은 새로 가입할 수 없습니다." 로 반려된다.
- 커스텀 SMTP 를 끄면 다시 팀 멤버 주소로만, 시간당 2통 제한으로 돌아간다.
