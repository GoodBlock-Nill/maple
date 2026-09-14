# 인증 — 콜백 · 세션 게이트 (`auth/callback`, `auth/callback/complete`)

**목적** 초대·비밀번호 재설정 메일 링크의 착지점. 세션을 확립하고 **관리자 계정인지 확인한 뒤** `next` 경로로 보낸다. 관리자 앱의 문턱은 "로그인에 성공했는가"가 아니라 "관리자로 승격된 계정인가"다.

**데이터 출처** `/auth/callback` 은 페이지가 아니라 **route handler**(`GET`)다. 화면 요소가 없고 리다이렉트만 한다. `/auth/callback/complete` 는 브라우저에서 해시를 읽어야 하는 경우에만 쓰는 중간 화면이다(`metadata.robots = { index:false, follow:false }`).

## 1.1 `/auth/callback` 분기 (`route.ts`)

Supabase 는 링크 종류와 프로젝트 설정에 따라 세 방식으로 돌려보낸다.

| 순서 | 입력 | 처리 | 실패 시 |
|---|---|---|---|
| 0 | `?error=…` | 제공자가 사용자 취소·설정 오류를 알리는 규격(OAuth 2.0 §4.1.2.1) | `/login?error=auth_failed` |
| 1 | `?code=`(PKCE) | `exchangeCodeForSession(code)` → `rejectNonAdmin()` → `redirect(next)` | 교환 실패 `/login?error=link_expired` |
| 2 | `?token_hash=&type=` (메일 템플릿이 `{{ .TokenHash }}` 를 쓸 때) | `verifyOtp({ type, token_hash })` → `rejectNonAdmin()` → `redirect(next)`(아래 상세) | 검증 실패·유저 없음 → `/login?error=link_expired` |
| 3 | 둘 다 없음(암시적 흐름, `#access_token=…`) | `/auth/callback/complete?next=<정규화된 경로>` 로 리다이렉트(아래 상세) | — |

**동작 상세**

- **순서 2 처리** `type` 허용 목록 `ALLOWED_TYPES` = `invite`·`recovery`·`magiclink`·`signup`·`email`(밖이면 `null` 이 되어 3번으로 떨어진다).
- **순서 3 처리** **해시는 서버로 전송되지 않는다.** 프래그먼트는 브라우저가 그대로 이어 붙이므로 정보가 유실되지 않는다.

| 파라미터 | 규칙 |
|---|---|
| `next` | `sanitizeNextPath(searchParams.get('next'))` — 내부 절대 경로만, 아니면 `/`(아래 상세) |

- **`next` 고정값** 초대 메일은 `inviteRedirectTo()` 가 `/invite/accept` 로 고정해 보낸다. 재설정 메일은 `/reset-password`.

**`rejectNonAdmin(supabase, userId, origin)`**
`profiles.role === 'admin'` 이면 통과(`null` 반환). 아니면 `signOut()` 후 `/login?error=not_admin` 으로 되돌린다. 초대 링크로 들어온 계정은 트리거가 이미 승격해 두었으므로 그대로 통과하고, **그 밖의 경로(예: 비밀번호 재설정 메일을 받은 일반 회원)로 세션이 생겨도 같은 잣대로 걸러진다** — 링크 하나로 비관리자가 관리자 쿠키를 얻는 우회로를 남기지 않는다.

## 1.2 `/auth/callback/complete` (`CallbackComplete`)

| 요소 | 내용 |
|---|---|
| 화면 | `bg-sidebar` 전체 화면 가운데 카드 하나(입력·버튼 없음, 아래 상세) |
| `next` | 서버 컴포넌트가 `sanitizeNextPath(firstValue(searchParams.next))` 로 정규화해 넘긴다 |

- **화면** 본문은 `aria-live="polite"` 인 문구 `로그인 처리 중입니다…` .

클라이언트 처리 순서

| 단계 | 내용 |
|---|---|
| 1 | `useRef` 가드 — 이펙트 중복 실행 방지(아래 상세) |
| 2 | `window.location.hash` 를 `URLSearchParams` 로 파싱 |
| 3 | `error` 가 있으면 `/login?error=link_expired` 로 `router.replace` |
| 4 | `access_token`·`refresh_token` 중 하나라도 비면 `/login?error=invalid_link` |
| 5 | `establishSessionAction()` 호출 → `setSession()` 이 httpOnly 쿠키로 옮긴다(아래 상세) |
| 6 | `window.history.replaceState()` 로 주소창 해시 제거(아래 상세) |
| 7 | 실패(`formError`)면 `/login?error=link_expired`, 성공이면 `router.replace(next)` + `router.refresh()` |

**동작 상세**

- **단계 1** React 18+ 개발 모드는 이펙트를 두 번 돌리는데 토큰 교환은 한 번만 해야 한다.
- **단계 5** `establishSessionAction(accessToken, refreshToken)` 서버 액션이 `supabase.auth.setSession()` 을 호출한다. 토큰이 자바스크립트가 접근 가능한 저장소에 남지 않는다.
- **단계 6** `window.history.replaceState(null, '', pathname)`. 남겨 두면 뒤로가기 기록·화면 공유·북마크에 액세스 토큰이 그대로 실린다.

`establishSessionAction` 의 반환 문구: 토큰이 비었으면 `유효하지 않은 링크입니다.`, `setSession()` 실패면 `링크가 만료되었습니다. 다시 요청해 주세요.`

> 이 경로에는 `rejectNonAdmin()` 이 없다. 비관리자 계정이 암시적 흐름으로 들어오면 세션이 서고 `next` 로 이동한 뒤, 그 화면의 `requireAdmin()` 이 `signOut()` + `/login?error=not_admin` 으로 되돌린다(한 박자 늦게 걸린다).

## 1.3 부록 — 세션 유지와 30분 비활동 만료 (`admin/proxy.ts`)

Next.js 16 부터 `middleware.ts` 는 `proxy.ts` 로 이름이 바뀌었고, 여기서 하는 일은 세 가지다.

| 규칙 | 내용 |
|---|---|
| 세션 갱신 | 모든 요청에서 `updateSession(request)` 로 액세스 토큰 갱신(아래 상세) |
| 공개 경로 | `PUBLIC_PREFIXES` 목록, 그 밖은 미로그인 시 `/login?next=…`(아래 상세) |
| 비활동 만료 | `admin_last_seen` 쿠키로 30분 비활동 시 로그아웃(아래 상세) |
| 로그인 화면 되돌리기 | 로그인 상태로 `/login` 에 오면 대시보드(`/`)로 보낸다 |
| 제외 경로 | `matcher` 가 정적 자산 경로를 제외(아래 상세) |

**동작 상세**

- **세션 갱신** 리다이렉트를 만들 때는 `redirectWithSession()` 으로 갱신된 쿠키를 반드시 옮겨 싣는다 — 버리면 리프레시된 토큰이 저장되지 않아 임의로 로그아웃된다.
- **공개 경로** `PUBLIC_PREFIXES` = `/login` · `/forgot-password` · `/reset-password` · `/invite/accept` · `/auth/callback`(하위 포함). 그 밖의 경로는 미로그인 시 `/login?next=<pathname+search>`.
- **비활동 만료** 쿠키는 httpOnly · `sameSite:'lax'` · `secure`(https 일 때) · `path:'/'` · `maxAge` 1800초로 매 요청 시각을 적는다. `now - stamp > 30분`(`INACTIVITY_LIMIT_MS`)이면 `signOut()` 후 `/login?error=expired` + 쿠키 삭제. 값이 없거나 숫자가 아니면 만료로 보지 않는다(로그인 직후 첫 요청이 튕기지 않게).
- **제외 경로** `matcher` 가 `_next/static`·`_next/image`·`favicon.ico`·이미지/폰트 확장자를 뺀다 — 통과시키면 자산 요청마다 Auth 서버 왕복이 생긴다.

**이 쿠키는 보안 경계가 아니라 편의 장치다.** 지우면 타이머가 초기화되지만 지울 수 있는 쪽은 이미 인증 쿠키를 쥔 브라우저뿐이라 새로 얻는 권한이 없다. 진짜 만료는 Supabase 세션 수명이 강제한다. 프록시의 인증 검사도 낙관적이며, 실제 인가는 `requireAdmin()` 과 RLS `is_admin()` 두 겹이 맡는다(Next 문서가 경고하듯 프록시는 인가의 완결된 해법이 아니다).

**클라이언트와의 상호작용** 없음. 사용자 사이트에도 `proxy.ts` 가 있지만 규칙이 다르다(탈퇴 대기·온보딩 게이트, `/about` 차단 등) — 서로 다른 앱의 서로 다른 파일이다.

**오류·예외**

- `next` 에 외부 URL·`//host`·백슬래시를 넣어도 `sanitizeNextPath()` 가 `/` 로 떨어뜨린다(오픈 리다이렉트 차단).
- 메일 템플릿 설정에 따라 1·2·3 중 어느 경로로 오는지가 달라진다. 세 경로 모두 구현돼 있어 템플릿을 바꿔도 깨지지 않는다.
- 링크를 두 번 쓰면(이미 소비된 code/token) `link_expired` 로 끝난다.
- 콜백은 감사 로그를 남기지 않는다 — 누가 언제 초대를 수락했는지는 `admin_invites.accepted_at` 과 `profiles.created_at` 으로만 확인할 수 있다.
