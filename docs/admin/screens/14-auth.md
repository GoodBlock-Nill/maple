# 인증 화면 — 화면·기능 설명

> 관리자 콘솔(`admin/`)의 인증 화면. 경로 · 권한 · 화면 구성 · 동작(서버 액션) · 클라이언트(사용자 사이트)와의 상호작용을 개발 참고용으로 정리한다.
> 작성 규칙: 코드에서 확인한 사실만 쓴다. 파일 경로는 저장소 루트 기준. 워딩은 "카테고리"(말머리 금지).
> 초대 흐름·권한 모델의 전체 배경은 `admin/README.md` §4를 참고한다(이 문서는 화면·액션 사실만 다룬다).

## 0. 한눈에

| 항목 | 값 |
|---|---|
| 경로 | `(auth)/login`, `(auth)/forgot-password`, `(auth)/reset-password`, `(auth)/invite/accept`(모두 사이드바 없는 레이아웃), `auth/callback`(route) + `auth/callback/complete`(page) |
| 권한 모듈 | 없음(로그인 전 화면). `/auth/callback`이 세션 생성 직후 `profiles.role === 'admin'`을 확인해, 아니면 즉시 로그아웃시킨다 |
| 주요 테이블 | `profiles`(role 확인), Supabase Auth(`auth.users`, 세션) |
| 클라이언트 영향 | 없음(관리자 콘솔 전용, 사용자 사이트와 무관) |
| 관련 파일 | `admin/app/(auth)/**`, `admin/app/auth/callback/**`, `admin/components/auth/*`, `admin/lib/{actions,validation}/auth.ts`, `admin/lib/auth/session.ts`, `admin/proxy.ts` |

## 1. 로그인 (`(auth)/login`)

**목적** 이메일 + 비밀번호 로그인. 간편로그인(구글·카카오·네이버) 버튼은 2026-09-09 제품 결정으로 없앴다 — 관리자 계정은 초대 메일로만 만들어지고 로그인 수단은 비밀번호 하나뿐이다.

**화면 구성**
- 이메일 · 비밀번호 입력, "비밀번호 재설정" 링크(`/forgot-password`).
- `?error=` 코드별 안내 배너(`LOGIN_ERROR_MESSAGES`): `not_admin`·`expired`·`invalid_link`·`link_expired`·`auth_failed`·`session_required`.
- 로컬 개발 전용 미리 채움: `ADMIN_LOGIN_PREFILL_EMAIL`/`ADMIN_LOGIN_PREFILL_PASSWORD` 환경 변수(운영 배포에는 설정 금지 — 공개 HTML에 비밀번호가 그대로 실린다).

**동작(서버 액션)**
| 동작 | 액션 함수 | 검증 | 동작 | 감사 로그 | 클라이언트 영향 |
|---|---|---|---|---|---|
| 로그인 | `signInAction` (`admin/lib/actions/auth-actions.ts`) | zod `loginSchema`(`admin/lib/validation/auth.ts`) | `signInWithPassword()` → `profiles.role` 확인, 관리자 아니면 즉시 `signOut()` | 없음 | 없음 |

**주의**
- 로그인 실패는 "이메일 또는 비밀번호가 올바르지 않습니다"로 통일한다 — 어느 쪽이 틀렸는지 구분해 답하면 계정 열거(enumeration) 창구가 된다.
- 성공해도 `profiles.role !== 'admin'`이면 세션을 남기지 않는다(로그인은 됐는데 모든 화면이 튕기는 상태를 막기 위해).

## 2. 비밀번호 찾기 (`forgot-password`)

**목적** 가입한 이메일로 재설정 메일을 보낸다.

**화면 구성** 이메일 입력 한 칸. "로그인으로 돌아가기" 링크.

**동작(서버 액션)**
| 동작 | 액션 함수 | 검증 | 동작 | 감사 로그 | 클라이언트 영향 |
|---|---|---|---|---|---|
| 재설정 메일 발송 | `requestPasswordResetAction` | zod `forgotPasswordSchema` | `resetPasswordForEmail(email, { redirectTo: adminSiteUrl() + '/auth/callback?next=/reset-password' })` | 없음 | 없음 |

**주의**
- 성공/실패와 무관하게 항상 같은 안내("입력하신 주소로 재설정 메일을 보냈습니다")를 보여준다 — 계정 열거 방지. 실제 발송 실패는 서버 로그로만 남는다.

## 3. 새 비밀번호 설정 (`reset-password`)

**목적** 재설정 메일 링크를 타고 도착해 새 비밀번호를 저장한다.

**화면 구성**(`SetPasswordForm`) 새 비밀번호 · 새 비밀번호 확인(10~72자, `ADMIN_PASSWORD_MIN/MAX_LENGTH`). 세션 유무는 화면에서 미리 검사하지 않는다 — 링크를 막 통과한 직후에는 결과가 흔들려서, 없으면 액션이 "링크가 만료되었습니다"로 정확히 안내한다.

**동작(서버 액션)**
| 동작 | 액션 함수 | 검증 | 동작 | 감사 로그 | 클라이언트 영향 |
|---|---|---|---|---|---|
| 비밀번호 변경 | `setPasswordAction` | zod `setPasswordSchema`(길이 + 두 값 일치) | `getUser()`로 세션 확인 → `auth.updateUser({ password })` | 없음 | 없음 |

**주의**
- 이전과 같은 비밀번호로 바꾸면 Supabase가 `same_password` 에러를 주고, 화면은 필드 옆에 "이전과 다른 비밀번호를 입력해 주세요"로 안내한다.

## 4. 관리자 초대 수락 (`invite/accept`)

**목적** 초대 링크를 통해 이미 `role='admin'`으로 만들어진 계정이 스스로 비밀번호를 정하고 콘솔에 들어간다. 승격 자체는 `handle_new_user()` DB 트리거가 초대 행(`admin_invites`)을 보고 이미 끝낸 상태다(`admin/README.md` §4.3).

**화면 구성**
- 세션이 있으면(`/auth/callback`을 정상 통과) `SetPasswordForm`("비밀번호 설정하고 시작하기").
- 세션이 없으면(링크 만료/이미 사용) "초대 링크를 확인할 수 없습니다" 안내 카드 + "이미 비밀번호를 정했다면 로그인" 링크.

**동작(서버 액션)** §3과 동일한 `setPasswordAction`을 공용으로 쓴다.

## 5. 인증 콜백 (`auth/callback` route + `auth/callback/complete`)

**목적** 초대·비밀번호 재설정 메일 링크의 착지점. 세션을 확립하고 관리자 여부를 확인한 뒤 `next` 경로로 보낸다.

**동작**
- `?code=`(PKCE): `exchangeCodeForSession()` → `rejectNonAdmin()`.
- `?token_hash=&type=`(메일 템플릿이 `{{ .TokenHash }}`를 쓸 때): `verifyOtp()` → `rejectNonAdmin()`.
- 둘 다 없으면(암시적 흐름, `#access_token=…`은 서버로 전송되지 않는다): `/auth/callback/complete?next=`로 리다이렉트 → 브라우저(`CallbackComplete` 컴포넌트)가 해시를 읽어 `establishSessionAction(accessToken, refreshToken)` 서버 액션 호출 → `setSession()`으로 **httpOnly 쿠키**에 옮긴다 → `history.replaceState`로 주소창 해시를 지운 뒤 `next`로 이동.
- `rejectNonAdmin(supabase, userId, origin)`: `profiles.role !== 'admin'`이면 `signOut()` 후 `/login?error=not_admin`으로 되돌린다 — 초대 링크가 아닌 경로(예: 비밀번호 재설정 메일을 받은 일반 회원)로 세션이 생겨도 같은 잣대로 걸러낸다.
- `?error=`가 붙어 오면(OAuth 2.0 §4.1.2.1 규격) `/login?error=auth_failed`로 즉시 되돌린다.

**주의**
- `next` 파라미터는 `sanitizeNextPath()`로 정규화한다 — 내부 절대 경로(`/…`)만 허용하고 `//host`(프로토콜 상대 URL)·백슬래시는 거른다(오픈 리다이렉트 방지).
- 초대 메일의 `next`는 `admin-invite-actions.ts`의 `inviteRedirectTo()`가 `/invite/accept`로 고정해서 보낸다.

## 부록. 세션 유지 · 30분 비활동 만료 (`admin/proxy.ts`)

- 모든 요청에서 Supabase 세션(액세스 토큰)을 갱신하고, 미로그인 요청은 `/login?next=<원래경로>`로 돌린다(낙관적 검사 — 실제 인가는 `requireAdmin()`과 RLS `is_admin()` 두 겹이 강제한다).
- 로그인 없이 여는 경로(`PUBLIC_PREFIXES`): `/login`·`/forgot-password`·`/reset-password`·`/invite/accept`·`/auth/callback`.
- 30분 비활동 시 `signOut()` 후 `/login?error=expired`로 돌린다. 타이머는 `admin_last_seen`(httpOnly, `LAST_SEEN_COOKIE`, `admin/lib/auth/session.ts`) 쿠키로 매 요청 갱신된다 — 이 쿠키는 **보안 경계가 아니라 편의 장치**다(진짜 만료는 Supabase 세션 수명이 강제).
- 로그인된 상태로 `/login`에 오면 대시보드(`/`)로 돌린다(뒤로가기로 흔히 발생).
