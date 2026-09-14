# 인증 — 로그인 (`(auth)/login`)

**목적** 초대받아 만들어진 관리자 계정으로 콘솔에 들어간다. 관리자 콘솔의 **유일한** 진입 화면이다.

**데이터 출처** 조회 없음. `?next=` 와 `?error=` 만 읽어 그린다 — `nextPath = sanitizeNextPath(firstValue(searchParams.next))`(기본 `/`), `initialError = loginErrorMessage(firstValue(searchParams.error)) ?? ''`(표에 없는 코드는 빈 문자열).

카드: 제목 `관리자 로그인`, 설명 "초대받은 관리자 계정으로 로그인하세요."

## 1.1 로그인 폼 (`LoginForm`)

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값·프리필 | 동작 / 상호작용 |
|---|---|---|---|---|
| next | hidden | `sanitizeNextPath()` 를 통과한 내부 경로 | `/` 또는 `?next=` 값 | 로그인 성공 시 이 경로로 `redirect()`. 서버 액션이 한 번 더 `sanitizeNextPath()` 한다 |
| 안내 배너 | `FormBanner` | — | `?error=` 문구 | **액션 결과가 우선**이다 — 새로 시도해 실패했다면 그 문구가 더 정확하므로 `state.formError ?? initialError` 순서로 고른다 |
| 이메일 | `type="email"`, `autoComplete="username"`, `required` | `loginSchema.email`: trim → 1자 이상("이메일을 입력해 주세요.") → ≤254자 → `z.email('이메일 형식이 올바르지 않습니다.')` | `ADMIN_LOGIN_PREFILL_EMAIL`(없으면 빈 값) | `signInWithPassword({ email, password })` |
| 비밀번호 | `type="password"`, `autoComplete="current-password"`, `required` | `z.string().min(1, '비밀번호를 입력해 주세요.')` — **로그인에서는 길이 상한을 검사하지 않는다**(기존 계정을 막지 않기 위해. 10~72자 규칙은 설정할 때만 적용) | `ADMIN_LOGIN_PREFILL_PASSWORD`(없으면 빈 값) | 글자수 표시 없음 |
| 로그인 | 제출 버튼(전체 폭) | — | — | `signInAction`. 진행 중 `로그인 중…` + 비활성 |
| 비밀번호 재설정 | 링크(가운데) | — | — | `/forgot-password` |

**로컬 개발 전용 미리 채움** `ADMIN_LOGIN_PREFILL_EMAIL`·`ADMIN_LOGIN_PREFILL_PASSWORD` 환경 변수. **운영(Vercel)에는 설정 금지** — 공개 URL 의 HTML 에 관리자 비밀번호가 그대로 실린다(`defaultValue` 로 렌더된다).

## 1.2 서버 동작 (`signInAction`)

| 단계 | 내용 |
|---|---|
| 검증 | `loginSchema` → 실패 시 필드 오류 |
| 인증 | `supabase.auth.signInWithPassword()` |
| 실패 | **어느 쪽이 틀렸는지 구분하지 않는다** → `이메일 또는 비밀번호가 올바르지 않습니다.`(계정 열거 차단). 잠금·시도 횟수 제한은 앱에 없다(Supabase 쪽 정책에 맡긴다) |
| 관리자 확인 | `profiles.role` 조회 → `'admin'` 이 아니면 **`signOut()` 후** `NOT_ADMIN_MESSAGE`("관리자 권한이 없는 계정입니다. 슈퍼어드민에게 관리자 초대를 요청해 주세요.") |
| 성공 | `redirect(sanitizeNextPath(next))` — 기본 대시보드(`/`) |
| 감사 | **남기지 않는다** |

`redirect()` 는 예외를 던져 흐름을 끊으므로 항상 마지막 문장이며 `try/catch` 안에서 부르지 않는다.

**상태·문구 의미**

| 상황 | 화면 |
|---|---|
| 이메일 형식 오류 | 이메일 입력 아래 필드 오류 |
| 자격 증명 불일치 · 존재하지 않는 계정 | 상단 배너(같은 문구) |
| 관리자 아님 | 상단 배너 + 세션 없음(다시 로그인해도 결과 동일) |
| 차단된 계정(관리자 삭제로 `ban_duration` 100년) | Supabase 가 인증을 거절 → 같은 "이메일 또는 비밀번호가 올바르지 않습니다." |
| `?error=expired` 등으로 도착 | 상단 배너에 해당 안내(→ [README](README.md) §2 표) |

**클라이언트와의 상호작용**

- 사용자 사이트와 무관하다(사용자 사이트의 `/login` 은 별개 앱·별개 화면이며 간편로그인만 제공한다).
- **로그인된 상태로 `/login` 에 오면** `admin/proxy.ts` 가 대시보드(`/`)로 돌려보낸다(뒤로가기로 흔히 발생).
- 미로그인 상태로 보호 경로를 열면 `proxy.ts` 가 `/login?next=<원래경로+쿼리>` 로 보낸다 → 로그인 후 그 화면으로 복귀한다.

**오류·예외**

- 프록시의 로그인 검사는 **낙관적**이다. 실제 인가는 `requireAdmin()`(`getUser()` 로 검증 — `getSession()` 은 쿠키의 JWT 를 그대로 신뢰해 위조 쿠키를 통과시킨다)과 RLS `is_admin()` 두 겹이 강제한다.
- 로그인 성공 직후 첫 요청에는 `admin_last_seen` 쿠키가 없다. `isInactive()` 가 값 없음을 `false` 로 보기 때문에 로그인하자마자 튕기지 않는다.
- 비밀번호를 아직 정하지 않은 초대 계정은 여기서 로그인할 수 없다 — 초대 메일 링크(`/invite/accept`)를 먼저 타야 한다.
