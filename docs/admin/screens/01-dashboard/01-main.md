# 대시보드 (`/`)

**목적** 오늘 기준 운영 지표와 최근 활동을 한 화면에서 확인한다. 운영자가 출근 직후 "밀린 것이 있는가"(미처리 신고·대기 문의·처리 대기 쿠폰)를 먼저 보고, 조치가 필요한 메뉴로 건너뛰는 출발점이다.

**데이터 출처**
- `getDashboardMetrics(now = new Date())` (`admin/lib/data/dashboard.ts`) — 세션 클라이언트로 14개 질의를 `Promise.all` 로 한 번에 던진다. 전부 `select('id', { count: 'exact', head: true })` 라 행을 가져오지 않는다(페이로드 0).
- `getRecentActivity()` (같은 파일) — `posts`·`comments`·`inquiries`·`reports` 를 각각 `created_at desc limit 10` 으로 읽고, 애플리케이션에서 `createdAt` 문자열 내림차순 정렬 후 상위 10건만 남긴다(`RECENT_LIMIT = 10`).
- 기간 경계(`boundaries()`): `today = kstStartOfDay(now)`, `week = now - 7일`, `month = now - 30일`.
- 조회 실패 시 화면: 지표는 카드별로 "집계 실패"(`COUNT_FAILED`), 최근 활동은 조회가 깨진 테이블의 몫이 빠진 채 나머지만 표시된다(`posts.data ?? []`). 배너는 없다.
- 권한 없음(`dashboard` 가 `none`): 지표·활동을 아예 읽지 않고 `PageHeader`(제목 "대시보드", 설명 "열람 권한이 없는 화면입니다.") + 안내 배너만 그린다.

## 1.1 권한 안내 배너
`?error=forbidden` 이 붙어 들어왔을 때만(그리고 read 권한이 없을 때는 항상) 표시한다.

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값·프리필 | 동작 / 상호작용 |
|---|---|---|---|---|
| 권한 안내 배너 | `FormBanner` | — | 숨김 | 조건 충족 시 지표 위에 표시(아래) |

**동작 상세**
- **권한 안내 배너** — `firstValue(searchParams.error) === 'forbidden'` 이면 지표 위에 뜬다. 문구는 페이지 상수 `FORBIDDEN_MESSAGE` — "이 화면을 볼 권한이 없습니다. 필요하면 슈퍼어드민에게 요청해 주세요." 닫기 버튼 없음(다른 화면으로 이동하면 사라진다).

## 1.2 지표 카드 (`StatCard` 9장)
2열(`grid-cols-2`, lg 이상 4열) 그리드. 카드는 링크가 아니다 — 값만 보여 주고, 이동은 아래 최근 활동 목록으로 한다. 큰 숫자는 `toLocaleString('ko-KR')` 로 천 단위 콤마를 찍는다.

| 카드(label) | 값(today) 질의 | hint(카드 아래 줄) | 톤 | testId |
|---|---|---|---|---|
| 신규 가입 | `profiles.created_at >= KST 오늘 자정` | `7일 N · 30일 N` (같은 질의의 7·30일 경계) | 기본 | `stat-profiles` |
| 뉴스 등록 | `posts` where `board='news'` and `created_at >= 오늘` | `7일 N · 30일 N` | 기본 | `stat-news` |
| 커뮤니티 글 | `posts` where `board='community'` and `created_at >= 오늘` | `7일 N · 30일 N` | 기본 | `stat-community` |
| 댓글 | `comments.created_at >= 오늘` | `7일 N · 30일 N` | 기본 | `stat-comments` |
| 미처리 신고 | `reports.status = 'open'` (기간 조건 없음 — 누적 전체) | 고정 문자열 `상태 open` | 값 > 0 이면 `danger` | `stat-reports` |
| 대기 문의 | `inquiries.status = 'pending'` (누적 전체) | 고정 문자열 `상태 pending` | 값 > 0 이면 `warn` | `stat-inquiries` |
| 처리 대기 쿠폰 | `coupon_redemptions.status = 'pending'` (누적 전체) | `지급·거절을 아직 기록하지 않은 등록` | 값 > 0 이면 `warn` | `stat-coupon-redemptions` |
| 탈퇴 대기 | `profiles` where `deleted_at is not null` and `purged_at is null` | `파기까지 {PURGE_RETENTION_DAYS}일 · 그 안에 재로그인하면 복구` | 기본 | `stat-withdrawn` |
| 지난 7일 파기 | `profiles.purged_at >= now - 7일` | `개인정보 영구 삭제 완료` | 기본 | `stat-purged` |

- **기간 카드 4종**(신규 가입·뉴스 등록·커뮤니티 글·댓글)은 `MetricWindow { today, week, month }` 를 돌려주고, 큰 숫자는 `today`, 아래 줄은 `windowHint()` 가 만든 `7일 … · 30일 …` 이다.
- **누적 카드 5종**은 창이 없다(`number | null` 하나). 힌트는 코드에 박힌 고정 문구다.
- 톤 판정은 `isPositive(value) = value !== null && value > 0` — 집계 실패(`null`)를 위험 신호로 물들이지 않는다.
- 페이지 헤더 설명: "오늘 기준 수치입니다. 카드 아래 줄은 최근 7일 · 30일 누계입니다."

## 1.3 최근 활동 (`RecentActivity`)
`Card` + `CardHeader`(제목 "최근 활동", 설명 "게시글 · 댓글 · 문의 · 신고를 시간순으로 묶었습니다."). 행 전체가 `<Link>` 다.

| 필드/컨트롤 | 종류 | 값의 출처 | 표시 규칙 | 클릭 시 이동 |
|---|---|---|---|---|
| 종류 뱃지 | `Badge`(폭 68px 고정, 가운데 정렬) | `kind` | 뉴스=`accent` / 커뮤니티=`neutral` / 댓글=`neutral` / 문의=`warn` / 신고=`danger` | — |
| 제목 | 한 줄 텍스트(`truncate`) | 종류별 소스(아래) | `{reason}` 은 enum 원문(아래) | 종류별 경로(아래) |
| 작성자/구분 | 오른쪽 정렬 텍스트(sm 미만에서는 숨김) | 종류별 값(아래) | 폭 28(7rem) 고정 · `truncate` | — |
| 시각 | `<time dateTime={createdAt}>` | `created_at` | `formatRelativeDay()` — KST 기준 오늘이면 `HH:mm`, 아니면 `YYYY-MM-DD` | — |
| 행(전체) | `<Link>` | `href` | hover 배경 + 포커스 링 | 종류별 경로(아래) |
| 빈 목록 | 안내 문구 | — | 네 질의가 모두 비면 "최근 활동이 없습니다." | — |

**동작 상세**
- **제목(값의 출처)** — 뉴스·커뮤니티는 `posts.title`, 댓글은 `comments.content`(공백 접어 40자 + `…`, `truncate()`), 문의는 `inquiries.title`, 신고는 `"게시글 신고 · {reason}"` / `"댓글 신고 · {reason}"`.
- **제목(표시 규칙)** — 신고의 `{reason}` 은 **`report_reason` enum 원문**(`spam`·`abuse`·`obscene`·`privacy`·`other`)이다 — 여기서는 한국어 라벨(`REPORT_REASON_LABEL`)로 바꾸지 않는다.
- **작성자/구분(값의 출처)** — 게시글·댓글은 `author_name`, 문의는 `inquiries.category`(카테고리 키 원문), 신고는 고정 문자열 `신고 접수`.
- **행(전체)(클릭 시 이동)** — 뉴스 → `/news`, 커뮤니티 → `/community/posts`, 댓글 → `/community/comments`, 문의 → `/inquiries`, 신고 → `/reports`.
- 이동 경로는 **메뉴 목록**이다. 개별 글·댓글·문의·신고의 상세로 딥링크하지 않는다(`href` 에 id 를 싣지 않는다).
- 정렬은 ISO 문자열의 `localeCompare` 내림차순이다 — 네 테이블이 모두 `timestamptz` 를 같은 ISO 형식으로 돌려주므로 문자열 비교가 곧 시간순이다.

**상태·뱃지 의미**
| 값 | 라벨 | 색 | 언제 |
|---|---|---|---|
| `news` | 뉴스 | accent | `posts.board = 'news'` |
| `community` | 커뮤니티 | neutral | `posts.board = 'community'` |
| `comment` | 댓글 | neutral | `comments` 행 |
| `inquiry` | 문의 | warn | `inquiries` 행 |
| `report` | 신고 | danger | `reports` 행 |

**클라이언트와의 상호작용**
- 관리자 → 사용자 사이트 방향: **없음.** 이 화면에는 서버 액션이 없고 `revalidateClient()` 도 부르지 않는다.
- 사용자 사이트 → 관리자 방향: 사용자가 남긴 것(커뮤니티 글·댓글·신고 접수·1:1 문의·쿠폰 등록)이 그대로 카드 숫자와 최근 활동에 들어온다. 숨김·삭제 여부는 **거르지 않는다** — `posts`·`comments` 질의에 `is_hidden`·`deleted_at` 조건이 없어, 운영자가 숨긴 글도 "커뮤니티 글" 카운트와 최근 활동에 남는다.
- 관리자 계정으로 읽으므로 `posts_select_admin` / `comments_select_admin` 이 적용되어 임시저장·예약·숨김 글까지 집계에 포함된다.

**오류·예외**
- 질의 하나가 실패하면 그 카드만 "집계 실패"가 되고 나머지는 정상 표시된다(`runCount()` · `toCount()` 가 각각 `null` 로 떨어뜨린다).
- 최근 활동의 한 테이블이 실패하면 그 종류만 목록에서 빠진다. 화면에는 실패 표시가 없다(서버 로그만 남는다).
- `dashboard` 가 `none` 인 관리자는 지표·활동을 볼 수 없고 배너만 본다. 다른 메뉴에서 권한 없이 진입해 되돌아온 경우에도 같은 배너를 본다.
- 로그인하지 않았거나 `profiles.role !== 'admin'` 이면 `requireAdmin()` 이 로그아웃시키고 `/login?error=not_admin`(세션 없음이면 `/login?error=session_required`)으로 보낸다.
