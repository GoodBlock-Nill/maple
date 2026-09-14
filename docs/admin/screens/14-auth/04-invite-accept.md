# 인증 — 관리자 초대 수락 (`(auth)/invite/accept`)

**목적** 초대 링크를 타고 온 사람이 **스스로 비밀번호를 정하고** 콘솔에 들어간다. 이 화면이 하는 일은 그 하나뿐이다 — 승격은 이미 끝나 있다. `handle_new_user()` 트리거가 초대 행(`admin_invites`)을 보고 `profiles.role='admin'` + `admin_role_id` 를 가입 시점에 넣는다.

**데이터 출처** `createClient()` → `supabase.auth.getUser()` 한 번. 결과에 따라 화면이 둘로 갈린다(**여기서만 세션을 미리 확인한다** — 링크가 만료됐거나 이미 쓰인 경우 폼을 보여 주면 제출 뒤에야 실패를 알게 되므로).

## 1.1 세션이 있을 때 — 비밀번호 설정

카드 제목 `관리자 초대 수락`, 설명 "사용할 비밀번호를 정하면 관리자 콘솔에 들어갑니다."

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값 | 동작 / 상호작용 |
|---|---|---|---|---|
| next | hidden | — | `'/'` | 성공 시 대시보드로 이동 |
| 새 비밀번호 | `type="password"`, `autoFocus`, `required`, `maxLength=72` | 10~72자(`setPasswordSchema`) | 빈 값 | 힌트 "10~72자. 어깨너머로 길이가 읽히지 않도록 글자수는 세지 않습니다." |
| 새 비밀번호 확인 | `type="password"`, `required`, `maxLength=72` | 위 값과 일치("비밀번호가 일치하지 않습니다.") | 빈 값 | — |
| 비밀번호 설정하고 시작하기 | 제출 버튼(전체 폭) | — | — | `setPasswordAction`(재설정 화면과 **같은 액션**, `submitLabel` 만 다르다). 진행 중 `저장 중…` |

동작·오류 문구는 [03-reset-password.md](03-reset-password.md) §1.2 와 동일하다.

## 1.2 세션이 없을 때 — 안내 카드

| 요소 | 내용 |
|---|---|
| 제목 | `초대 링크를 확인할 수 없습니다` |
| 설명 | "링크가 만료되었거나 이미 사용되었습니다. 슈퍼어드민에게 초대 재발송을 요청해 주세요." |
| 링크 | `이미 비밀번호를 정했다면 로그인` → `/login` |

폼은 렌더하지 않는다.

## 1.3 초대 전체 흐름

| 단계 | 일어나는 일 | 코드 |
|---|---|---|
| 1 | 슈퍼어드민이 이메일 + 역할로 초대 → `admin_invites` 에 `pending` 행(7일 수명) 먼저 만들고 메일 발송 | `inviteAdminAction`(→ `12-admins/02-invite-form.md`) |
| 2 | `inviteUserByEmail()` 이 메일을 보내는 **순간** `auth.users` 행이 생기고 `handle_new_user()` 트리거가 돈다 → 초대가 `pending` 且 만료 전이면 `profiles.role='admin'` + `admin_role_id` 부여, 같은 트랜잭션에서 초대를 `accepted` 로 닫는다 | DB 트리거 |
| 3 | 받은 사람이 메일 링크 클릭 → `{NEXT_PUBLIC_ADMIN_URL}/auth/callback?next=%2Finvite%2Faccept` | `inviteRedirectTo()` |
| 4 | 콜백이 세션을 확립하고 `profiles.role === 'admin'` 을 확인한 뒤 `/invite/accept` 로 보낸다 | [05-callback.md](05-callback.md) |
| 5 | 이 화면에서 비밀번호를 정하면 `updateUser({ password })` → 대시보드 | `setPasswordAction` |

**클라이언트와의 상호작용**

- 사용자 사이트와 무관하다. 링크는 관리자 앱 자신을 가리킨다(`NEXT_PUBLIC_ADMIN_URL`, 미설정 시 `http://localhost:3100`) — **이 값이 운영 도메인으로 설정돼 있지 않으면 초대 메일이 로컬 주소를 가리킨다.**
- 이 경로는 `admin/proxy.ts` 의 `PUBLIC_PREFIXES` 에 있어 로그인 없이 열린다.

**오류·예외**

- 초대 링크의 수명(Supabase 기본 24시간)과 `admin_invites.expires_at`(7일)은 별개다. 링크만 만료된 경우 슈퍼어드민이 `재발송`을 누르면 새 링크 + 만료 연장으로 이어갈 수 있다.
- 초대가 만료되거나 `revoked` 인 상태에서 링크를 타면 계정은 만들어져도 **`role='admin'` 이 되지 않아** 콜백의 `rejectNonAdmin()` 이 `/login?error=not_admin` 으로 되돌린다(이 화면에 도달하지 못한다).
- 비밀번호를 정하기 전에 브라우저를 닫아도 계정은 이미 관리자다. 그때는 `/forgot-password` 로 비밀번호를 설정하면 들어올 수 있다(같은 `setPasswordAction` 경로).
- 세션 확인은 `getUser()` 를 쓴다(`getSession()` 은 쿠키의 JWT 를 그대로 신뢰한다).
