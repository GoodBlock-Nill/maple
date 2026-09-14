# 인증 — 비밀번호 찾기 (`(auth)/forgot-password`)

**목적** 가입한 이메일로 비밀번호 재설정 링크를 보낸다. 관리자 스스로 비밀번호를 되찾는 유일한 경로다(운영자가 대신 정해 주는 화면은 없다).

**데이터 출처** 조회 없음. 정적 페이지(`export default function`, async 아님)다. 카드 제목 `비밀번호 재설정`, 설명 "가입한 이메일로 재설정 링크를 보내 드립니다."

## 1.1 폼 (`ForgotPasswordForm`)

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값 | 동작 / 상호작용 |
|---|---|---|---|---|
| 오류 배너 | `FormBanner` | — | 없음 | `state.formError`(현재 액션이 반환하는 경로는 없다) |
| 성공 배너 | `FormBanner tone="success"` | — | 없음 | `state.message` — 발송 시도 후 항상 표시된다 |
| 이메일 | `type="email"`, `autoComplete="username"`, `autoFocus`, `required`, `maxLength=254` | `forgotPasswordSchema.email`: trim → 1자 이상 → ≤254자 → `z.email()`(아래 상세) | 빈 값 | 힌트(아래 상세) |
| 재설정 메일 보내기 | 제출 버튼(전체 폭) | — | — | `requestPasswordResetAction`. 진행 중 `보내는 중…` + 비활성 |
| 로그인으로 돌아가기 | 링크(가운데) | — | — | `/login` |

**동작 상세**

- **이메일 검증** `forgotPasswordSchema.email`: trim → 1자 이상("이메일을 입력해 주세요.") → ≤254자("이메일은 254자를 넘을 수 없습니다.") → `z.email('이메일 형식이 올바르지 않습니다.')`.
- **이메일 힌트** "가입에 쓴 주소로만 재설정 메일이 갑니다. 길이 상한은 메일 규격(RFC 5321)의 값입니다."

## 1.2 서버 동작 (`requestPasswordResetAction`)

| 단계 | 내용 |
|---|---|
| 검증 | `forgotPasswordSchema` → 실패 시 이메일 필드 오류 |
| 발송 | `supabase.auth.resetPasswordForEmail(email, { redirectTo: adminSiteUrl() + '/auth/callback?next=/reset-password' })` |
| 결과 | **성공·실패와 무관하게 같은 문구**를 돌려준다(아래 상세) |
| 실패 로그 | `console.error('[auth] 비밀번호 재설정 메일 발송 실패', message)` — 서버 로그에만 |
| 리다이렉트 | 없다(같은 화면에 성공 배너만 뜬다) |
| 감사 | 남기지 않는다 |

`adminSiteUrl()` = `NEXT_PUBLIC_ADMIN_URL`(끝 슬래시 제거), 미설정 시 `http://localhost:3100`.

- **결과 문구** `입력하신 주소로 재설정 메일을 보냈습니다. 메일함을 확인해 주세요.` — "가입되지 않은 이메일입니다"는 그대로 계정 열거 창구이므로 성공·실패를 구분하지 않는다.

**클라이언트와의 상호작용**

- 링크의 착지점은 관리자 앱의 `/auth/callback` 이고, 세션이 서면 `next=/reset-password` 로 보낸다 → [05-callback.md](05-callback.md) → [03-reset-password.md](03-reset-password.md).
- **일반 회원이 이 폼으로 메일을 받아 링크를 타도 콘솔에 들어올 수 없다** — `/auth/callback` 의 `rejectNonAdmin()` 이 `profiles.role !== 'admin'` 이면 세션을 끊고 `/login?error=not_admin` 으로 되돌린다.
- 사용자 사이트에는 대응 화면이 없다. 사용자 사이트 `proxy.ts` 의 `LEGACY_REDIRECTS` 가 `/forgot-password` 를 `/login` 으로 302 한다(간편로그인만 제공하므로).

**오류·예외**

- 메일이 실제로 도착했는지는 화면에서 알 수 없다(같은 문구를 보여 주는 설계의 대가).
- 발송 빈도 제한은 앱에 없다 — Supabase 프로젝트의 메일 레이트 리밋에 걸리면 발송만 실패하고 화면은 여전히 성공 문구를 보여 준다.
- 이 화면은 `proxy.ts` 의 `PUBLIC_PREFIXES` 에 있어 로그인 없이 열린다.
