# 신고 목록 (`/reports`)

**목적** 접수된 신고를 상태(미처리/처리 완료/기각)와 대상 유형(게시글/댓글)으로 추려 보고, 행에서 바로 원문을 확인하거나 상세 다이얼로그를 열어 처리·기각한다.

**데이터 출처**
- 진입 가드 `requirePermission('reports', 'read')`, 처리 버튼 노출은 `hasPermission(permissions, 'reports', 'write')`.
- `getReportCounts(type)` + `getReports(status, page, type)` (`admin/lib/data/reports.ts`)를 `Promise.all` 로 함께 읽는다. 전부 세션 클라이언트(RLS `reports_select_admin`).
- 페이지 크기 20, 정렬 고정 `created_at desc`(**정렬 UI 가 없다**).
- `export const dynamic = 'force-dynamic'`.
- 조회 실패: `{ rows: [], count: 0, hasError: true }` → 표 위 `FormBanner`(`LIST_LOAD_ERROR`). 건수 집계가 실패하면 탭 숫자가 `0` 으로 보인다(`open?.count ?? 0`).
- 페이지 설명: "접수된 신고를 검토하고 숨김·삭제·정지로 연계합니다. 처리 메모는 감사 로그에 남습니다."

## 1.1 상태 탭 (`ReportTabs`)
`<nav aria-label="신고 상태">` 안의 링크 3개. 상태를 갖지 않아 탭 전환이 곧 URL 이고, 뒤로가기·새로고침·공유가 같은 화면을 낸다.

| 필드/컨트롤 | 종류 | URL 파라미터 | 기본값 | 동작 / 상호작용 |
|---|---|---|---|---|
| 미처리 | `<Link>` + 건수 뱃지 | `?status=open` | **기본 탭** — `?status=` 가 없거나 `REPORT_STATUSES` 밖의 값이면 `open` 으로 떨어진다 | `buildHref()` 호출 규칙(아래) |
| 처리 완료 | 〃 | `?status=resolved` | — | 〃 |
| 기각 | 〃 | `?status=dismissed` | — | 〃 |
| 건수 뱃지 | 숫자(`toLocaleString('ko-KR')`) | — | — | `getReportCounts(type)` 집계 기준(아래) |
| 활성 표시 | — | — | — | `aria-current="page"` + 하단 border(accent) + 뱃지 배경 `accent-soft` |

**동작 상세**
- **미처리/처리 완료/기각** — `buildHref('/reports', searchParams, { status:'open', page:null })` — **유형 필터(`?type=`)는 유지**하고 페이지만 지운다.
- **건수 뱃지** — `getReportCounts(type)` — **현재 유형 필터가 걸린 채 센 값**이다(전체 탭에서 "게시글" 필터를 켜면 탭 숫자도 게시글만 센다). 상태별 `count: 'exact', head: true` 3질의.

## 1.2 유형 필터 (`ReportTypeFilter`)
`<nav aria-label="신고 대상 유형">` 안의 칩 3개. 상태 탭과 **축이 다르므로 동시에 적용된다**.

| 필드/컨트롤 | URL 파라미터 | 기본값 | 동작 |
|---|---|---|---|
| 전체 | `?type=` 없음 | **기본** | `buildHref(…, { type: null, page: null })` — 파라미터를 지운다 |
| 게시글 | `?type=post` | — | `query.eq('target_type','post')` + 탭 건수도 같은 조건으로 다시 센다 |
| 댓글 | `?type=comment` | — | 〃 |

`parseReportTargetType(raw)` — `post`·`comment` 만 받고 그 밖(옛 링크·오타)은 `undefined`(전체)로 떨어진다. 상태 탭과 마찬가지로 `page` 는 지우고 나머지 쿼리는 물려받는다.

## 1.3 표
`caption="신고 목록"`, 빈 결과 문구 `"이 상태의 신고가 없습니다."`. 정렬 헤더·검색·기간 필터는 없다.

| 열 | 종류 | 값의 출처 | 표시 규칙 | 동작 |
|---|---|---|---|---|
| 유형 | 뱃지 1~3개 (w-20) | `reports.target_type` + 대상 상태 | 유형·상태 뱃지 조합(아래) | — |
| 대상 | 2줄 셀 | `target.excerpt` / `target.postTitle` | 표시 규칙(아래) | 링크 규칙(아래) |
| 사유 | `Badge`(warn, w-28) | `reports.reason` | `REPORT_REASON_LABEL[reason]` | — |
| 상세 | 텍스트(muted, `line-clamp-2`, `title` 툴팁) | `reports.detail` | 신고자가 남긴 자유 입력. 비어 있으면 `-` | — |
| 신고자 | 텍스트(w-28) | `profiles.nickname`(FK 힌트 임베드) | 프로필을 못 읽으면 `(탈퇴)` | — |
| 신고일 | 텍스트(muted, w-36) | `reports.created_at` | `formatDateTime()` = KST `YYYY-MM-DD HH:mm` | — |
| 누적 | 우측 정렬 숫자(w-16) | `history.length` | 같은 대상에 접수된 **모든 상태**의 신고 건수. **2건 이상이면 `text-danger font-bold`** 로 강조 | — |
| 조치 | 버튼(우측, w-24) | — | `canWrite && status === 'open'` 이면 라벨 `처리`, 그 외에는 `상세` | 다이얼로그를 연다 → [02-detail-dialog.md](02-detail-dialog.md) |

**동작 상세**
- **유형(표시 규칙)** — 게시글 = `accent` + 문서 아이콘(`DocumentIcon`), 댓글 = `neutral` + 말풍선 아이콘(`CommentIcon`). 뒤에 대상이 `is_hidden` 이면 `숨김`(warn), `deleted_at != null` 이면 `삭제`(danger) 뱃지가 붙는다.
- **대상(표시 규칙)** — 1줄: 게시글이면 **제목**, 댓글이면 **본문 발췌**(공백을 접어 60자 + `…`, `excerpt()`). 대상을 못 찾으면 `(대상을 찾을 수 없음)`. 2줄(댓글만): `↳ 게시글: {원 게시글 제목}`, 원 글이 사라졌으면 `↳ 게시글: (삭제됨)`.
- **대상(동작)** — 1줄이 링크: `{CLIENT_SITE_URL}/community/{postId}` 새 탭. **댓글도 원 게시글로 간다**(댓글에는 자체 주소가 없다). 아래 "원문 링크 규칙" 참고.

**원문 링크 규칙** (`previewHrefOf(report)`) — 다음 중 하나라도 참이면 **링크를 걸지 않고 텍스트로만** 둔다.
1. 대상을 못 찾음(`report.target === null` → `postId` 가 `undefined`)
2. 게시글 대상인데 `postId` 가 없음(이론상)
3. **대상이 삭제됨**(`target.deletedAt !== null`) — 원문이 404 라서

숨김(`is_hidden`) 상태는 링크를 막지 않는다. 링크는 살아 있지만 사용자 사이트에서는 RLS 가 막아 404 가 뜬다.

**표에 없는 값** `reports.note`·`resolved_by`·`resolved_at` 은 목록 질의(`REPORT_COLUMNS`)가 읽지 않는다. **처리 완료·기각 탭에서도 "누가 언제 어떤 메모로 처리했는지"는 화면에 나오지 않는다** — 감사 로그(`/audit`)에서 확인한다.

## 1.4 페이지네이션
`buildHref('/reports', searchParams, { page: String(next) })` — 상태·유형을 그대로 물려받는다. 총 페이지 `ceil(count / 20)`, 최소 1.

## 1.5 동작(서버 액션)
이 화면 자체(탭·필터·표·페이지)는 **조회 전용**이다. 상태 변경은 전부 상세 다이얼로그에서 일어난다.

**상태·뱃지 의미**
| 뱃지 | 값 | 톤 | 언제 |
|---|---|---|---|
| 게시글 / 댓글 | `target_type` | accent / neutral | 항상(아이콘 포함) |
| 숨김 | `target.isHidden` | warn | 대상이 숨김 상태 |
| 삭제 | `target.deletedAt != null` | danger | 대상이 소프트 삭제됨 |
| 사유 | `reason` | warn | 항상 |
| 누적 강조 | `history.length > 1` | 빨강 볼드 | 같은 대상에 2건 이상 접수됨 |

유형 뱃지의 톤·아이콘을 나눈 것은 운영 피드백(2026-09-14)이다 — 종전에는 둘 다 accent 뱃지에 글자만 달라 목록을 훑을 때 구분되지 않았다.

**클라이언트와의 상호작용**
- **관리자 → 사용자 방향은 없다.** `reports` 는 관리자 전용 큐이고 사용자 사이트가 읽지 않는다(캐시 태그 없음). 사용자는 자기가 낸 신고(`reports_select_own`)만 읽을 수 있지만, 화면 어디에도 그 목록을 그리지 않는다 — 접수 후 상태나 처리 결과를 사용자에게 알리는 경로는 없다.
- **사용자 → 관리자 방향(접수 흐름)**: 게시글 상세의 `PostActions` / 댓글의 `CommentActions` → `ReportDialog`(게시글·댓글 공용) → `ReportForm` → 서버 액션 `submitReport` (`lib/actions/report-actions.ts`) → `reports` INSERT.

| 접수 단계 | 규칙 | 실패 문구 |
|---|---|---|
| 로그인 | 비로그인 사용자는 버튼 노출 + 로그인 페이지로 이동(아래) | — |
| 정지 계정 | 다이얼로그는 열리지만 배너가 뜨고 제출 버튼이 잠긴다. 액션도 다시 검사한다 | `정지된 계정입니다 (YYYY-MM-DD까지 · 사유: …)` |
| 사유 | 라디오 5종 중 필수 | "신고 사유를 선택해 주세요." |
| 상세 내용 | 선택, 최대 500자(`REPORT_DETAIL_MAX`, DB CHECK `reports_detail_length`). 빈 문자열은 `null` 로 저장 | "상세 내용은 500자 이하로 입력해 주세요." |
| 쿨다운 | `REPORT_COOLDOWN_SECONDS = 10초`(아래) | "너무 빠르게 작성하고 있습니다. N초 후에 다시 시도해 주세요." |
| 대상 존재 | 삭제·비공개 대상은 조회되지 않는다(RLS 를 그대로 탄다) | "대상을 찾을 수 없습니다. 이미 삭제되었을 수 있습니다." |
| 자기 글 | 앱·DB 양쪽에서 막는다(`can_report_target()` 이 `author_id is distinct from auth.uid()` 를 본다) | "본인이 작성한 글은 신고할 수 없습니다." |
| 중복 | 유니크 제약 23505 | "이미 신고한 게시글입니다." / "이미 신고한 댓글입니다." |
| 성공 | 폼이 입력 영역을 감추고 완료 문구만 남긴다 | "신고가 접수되었습니다. 검토 후 운영정책에 따라 처리됩니다." |

- **로그인** — 비로그인 사용자에게는 **버튼을 보여 주되**(감추면 신고할 방법이 있다는 사실까지 사라진다) `/login?next={상세경로}` 로 보낸다. 액션에 직접 닿아도 같은 경로로 리다이렉트.
- **쿨다운** — 마지막 신고로부터 `REPORT_COOLDOWN_SECONDS = 10초`(글쓰기 30초보다 짧다 — 한 글타래에서 여러 댓글을 연달아 신고하는 것은 정상 행동).

- 접수된 행은 `status='open'` 으로 이 목록 **미처리 탭 맨 위**에 나타난다(정렬이 `created_at desc` 고정).
- 사용자가 볼 수 있는 값: 자기 신고의 사유·상세·상태. 관리자만 보는 값: 대상 전문, 같은 대상의 **다른 사람** 신고 이력, 누적 건수, 처리 메모.

**오류·예외**
| 상황 | 결과 |
|---|---|
| 목록 조회 실패 | 배너 + 빈 표. 원인은 `console.error('[reports] 목록 조회 실패', …)` |
| 대상이 완전히 사라짐 | 대상 칸 `(대상을 찾을 수 없음)`, 원문 링크 없음, 다이얼로그 본문도 안내 문구로 대체 |
| 신고자 프로필 없음(탈퇴) | 신고자 칸 `(탈퇴)` |
| 잘못된 `?status=`·`?type=` | 조용히 기본값(`open` / 전체)으로 떨어진다 |
| 권한 없음 | `/?error=forbidden` 리다이렉트 |
