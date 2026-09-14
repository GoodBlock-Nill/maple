# 인증 화면 — 메뉴 개요

> 관리자 콘솔(`admin/`)의 로그인 전 화면 묶음. 화면 하나당 파일 하나이며, 각 파일은 `_TEMPLATE.md` 형식을 따른다.
> 초대 흐름·권한 모델의 배경은 `admin/README.md` §4 참고. 여기서는 화면·필드·액션 사실만 적는다.

## 0. 한눈에

| 항목 | 값 |
|---|---|
| 경로 | `(auth)/login` · `(auth)/forgot-password` · `(auth)/reset-password` · `(auth)/invite/accept`(사이드바 없는 `AuthLayout`) + `auth/callback`(route handler) · `auth/callback/complete`(page) |
| 권한 모듈 | 없음(로그인 전). 대신 세 겹의 문 — ① `proxy.ts` 낙관적 세션 검사 ② `/auth/callback` 의 `rejectNonAdmin()`·`signInAction` 의 `profiles.role` 확인 ③ 페이지·액션의 `requireAdmin()`/`requirePermission()` + RLS `is_admin()` |
| 주요 테이블 | `profiles`(`role` 확인), Supabase Auth(`auth.users`, 세션 쿠키), `admin_invites`(승격 근거 — 트리거가 읽는다) |
| 클라이언트 영향 | 없음(관리자 콘솔 전용). 사용자 사이트에도 같은 이름의 경로가 있지만 **완전히 별개**이며, 사용자 사이트 `proxy.ts` 는 `/forgot-password`·`/reset-password` 를 `/login` 으로 302 한다 |
| 관련 파일 | 페이지 `admin/app/(auth)/**`, `admin/app/auth/callback/{route.ts,complete/page.tsx}` · 컴포넌트 `admin/components/auth/{AuthCard,LoginForm,ForgotPasswordForm,SetPasswordForm,CallbackComplete}.tsx` · 액션 `admin/lib/actions/auth-actions.ts` · 검증 `admin/lib/validation/auth.ts` · 세션 `admin/lib/auth/session.ts`, `admin/lib/supabase/middleware.ts` · 프록시 `admin/proxy.ts` · 환경 `admin/lib/supabase/env.ts` |

## 1. 화면 목록

| # | 문서 | 경로 | 한 줄 |
|---|---|---|---|
| 01 | [01-login.md](01-login.md) | `/login` | 이메일 + 비밀번호(유일한 로그인 수단), `?error=` 배너 |
| 02 | [02-forgot-password.md](02-forgot-password.md) | `/forgot-password` | 재설정 메일 발송(항상 같은 안내) |
| 03 | [03-reset-password.md](03-reset-password.md) | `/reset-password` | 새 비밀번호 저장 |
| 04 | [04-invite-accept.md](04-invite-accept.md) | `/invite/accept` | 초대 수락 — 비밀번호를 정하고 콘솔 진입 |
| 05 | [05-callback.md](05-callback.md) | `/auth/callback`, `/auth/callback/complete` | 메일 링크 착지점 · 세션 확립 · 비관리자 차단 · 세션 게이트 |

## 2. 메뉴 전체 규칙

- **로그인 수단은 비밀번호 하나**다. 간편로그인(구글·카카오·네이버) 버튼은 2026-09-09 제품 결정으로 없앴다 — 관리자 계정은 초대 메일로만 만들어지고, 소셜 버튼을 남기면 일반 회원이 눌러 보고 튕기는 문만 늘어난다.
- **계정 열거 방지** 로그인 실패는 어느 쪽이 틀렸는지 구분하지 않고 "이메일 또는 비밀번호가 올바르지 않습니다." 하나로 답한다. 재설정 메일은 성공·실패와 무관하게 항상 같은 안내를 보여 준다.
- **관리자가 아니면 세션을 남기지 않는다.** `signInAction` 과 `/auth/callback` 모두 `profiles.role !== 'admin'` 이면 즉시 `signOut()` 한다 — 남기면 "로그인은 됐는데 모든 화면이 튕기는" 상태에 갇히고, 로그인 폼도 이미 로그인된 세션 때문에 혼란스러워진다.
- **오픈 리다이렉트 차단** 모든 `next` 파라미터는 `sanitizeNextPath()` 를 거친다 — 내부 절대 경로(`/…`)만 허용하고 `//host`(프로토콜 상대 URL)와 백슬래시(`/\evil.example`)는 기본값 `/` 로 떨어뜨린다.
- **비밀번호 규칙** 10~72자(`ADMIN_PASSWORD_MIN_LENGTH`/`ADMIN_PASSWORD_MAX_LENGTH`). 하한은 Supabase 기본(6)보다 강하게 잡은 값이고, 상한은 bcrypt 가 73바이트째부터 버리기 때문이다(그보다 길면 뒤가 조용히 무시된다).
- **감사 로그 없음** 인증 액션은 `writeAuditLog()` 를 부르지 않는다 — 로그인·로그아웃·비밀번호 변경 이력은 `/audit` 에 남지 않는다.
- **레이아웃** `AuthLayout` 은 사이드바가 없는 유일한 영역(`bg-sidebar`, 화면 중앙 정렬). `AuthCard`(최대 380px)가 `글자월드 ADMIN` 로고 + 제목 + 설명 + 본문을 감싼다.
- **폼 공통** 모두 `noValidate`(브라우저 말풍선 대신 한국어 zod 메시지) + `useActionState`. `toFieldErrors()` 가 필드당 첫 오류 하나만 보여 준다.
- **`?error=` 코드 표**(`LOGIN_ERROR_MESSAGES`, 알 수 없는 코드는 아무것도 표시하지 않는다)

| 코드 | 문구 | 누가 붙이나 |
|---|---|---|
| `not_admin` | 관리자 권한이 없는 계정입니다. 슈퍼어드민에게 관리자 초대를 요청해 주세요.(`NOT_ADMIN_MESSAGE`) | `/auth/callback` 의 `rejectNonAdmin()`, `requireAdmin()` |
| `expired` | 30분 동안 활동이 없어 자동으로 로그아웃되었습니다. 다시 로그인해 주세요. | `proxy.ts` 비활동 만료 |
| `invalid_link` | 유효하지 않은 링크입니다. 메일의 링크를 다시 확인해 주세요. | `CallbackComplete`(해시에 토큰이 없음) |
| `link_expired` | 링크가 만료되었습니다. 비밀번호 재설정 메일을 다시 요청해 주세요. | `/auth/callback`(교환·검증 실패), `CallbackComplete` |
| `auth_failed` | 인증에 실패했습니다. 다시 시도해 주세요. | `/auth/callback`(`?error=` 가 붙어 옴) |
| `session_required` | 로그인이 필요합니다. | `requireAdmin()`(세션 없음) |
