# 감사 로그 — 목록 (`/audit`)

**목적** 관리자의 모든 변경 이력을 조건으로 좁혀 조회한다. "누가·언제·무엇을 어떻게 바꿨는가"를 되짚는 유일한 화면이며 읽기 전용이다.

**데이터 출처** `getAuditLogs(filters)` + `getAuditFilterOptions()` 를 `Promise.all`(`admin/lib/data/audit.ts`, 세션 클라이언트 → RLS `audit_logs_select_admin`).
- 목록: `audit_logs` 에 행위자 프로필을 조인(`actor:profiles!audit_logs_actor_id_fkey(id, nickname, email)`)해 `count:'exact'` 로 읽고, 필터를 얹은 뒤 `order('created_at', desc).order('id', desc).range()`. 페이지 크기 50. 실패 시 `console.error('[audit] 조회 실패')` + **빈 표 · 0건**(배너 없음).
- 필터 후보: 최근 `OPTION_SCAN_LIMIT`(1000)건을 훑어 **실제로 등장한** 행위자·테이블·action 만 모은다(테이블·action 은 정렬). 고정 목록이면 모듈이 붙을 때마다 여기를 고쳐야 하고, 고치지 않으면 필터가 조용히 뒤처진다.

## 1.1 필터 폼 (`AuditFilters`, GET)

`<form action="/audit" method="get">` — 필터 상태가 곧 URL 이라 링크로 공유하면 같은 화면이 열리고 새로고침해도 조건이 남는다.

| 필드/컨트롤 | 종류 | URL 파라미터 | 제한·후보 | 기본값 | 동작 / 상호작용 |
|---|---|---|---|---|---|
| 관리자 | 셀렉트 | `actor` | 최근 1000건에 등장한 행위자. 라벨 `{닉네임} ({이메일 또는 -})`, 값은 uuid | placeholder `전체` | `.eq('actor_id', …)`. 형식 검증 없음 — 이상한 값이면 결과 0건 |
| 대상 테이블 | 셀렉트 | `table` | 최근 1000건에 등장한 `target_table`. 라벨은 `auditTableLabel()` 한글 표기 | `전체` | `.eq('target_table', …)` |
| 행동 | 셀렉트 | `action` | 최근 1000건에 등장한 `action`. 라벨은 `auditActionLabel()` 조합 표기 | `전체` | `.eq('action', …)` — 완전 일치(접두사 검색 불가) |
| 시작일 | `type="date"` | `from` | — | 없음 | `kstLocalToIso('{from}T00:00')` → `.gte('created_at', …)`. **KST 하루 경계**로 환산 |
| 종료일 | `type="date"` | `to` | — | 없음 | `kstLocalToIso('{to}T23:59')` → `.lte('created_at', …)`. 그날 23:59 까지 포함 — 날짜만 비교하면 당일 로그가 통째로 빠진다 |
| 대상 ID | 텍스트(`maxLength` 36 = `UUID_LENGTH`) | `q` | — | 없음 | `.ilike('target_id', '%{q}%')` **부분 일치**. `%` 만 이스케이프한다(`_` 는 하지 않아 한 글자 와일드카드로 동작할 수 있다). placeholder "일부만 입력해도 됩니다", 라벨 옆 `현재/36` 표시 |
| 초기화 | 링크 버튼(ghost) | — | — | — | `/audit` 로 이동 — 모든 파라미터(페이지 포함)를 버린다 |
| 검색 | 제출 버튼 | — | — | — | 폼에 담긴 6개 값만 실려 나간다. **`page` 는 폼에 없어 자동으로 1페이지부터 다시 본다** |

레이아웃은 `md:grid-cols-3 lg:grid-cols-6`, 버튼 줄은 `lg:col-span-6` 우측 정렬.

## 1.2 표 (`AuditTable`)

카드 머리 `기록 {N}건` + "요약을 눌러 펼치면 변경 전후 전체를 볼 수 있습니다. 비밀번호·토큰 값은 가려집니다."
공용 `<Table>` 을 쓰지 않는다 — 한 로그가 요약 줄 + 펼침 영역으로 그려져야 하는데 공용 표는 행 하나에 셀 배열만 그린다. 가로 스크롤(`min-w-[900px]`).

| 열 | 종류 | 값의 출처 | 정렬 | 동작 / 상호작용 |
|---|---|---|---|---|
| 시각 | 일시(w-40, 줄바꿈 없음) | `created_at`(`formatDateTime`, KST) | **항상 `created_at desc, id desc` 고정**(정렬 변경 UI 없음) | — |
| 관리자 | 텍스트 2줄(w-48) | `profiles.nickname` / 아래 `email` | 불가 | 조인 결과가 없으면 `(삭제된 계정)` 하나만 표시(이메일 줄 없음) |
| 행동 | 텍스트(w-44) | `auditActionLabel(action)` | 불가 | 표기 규칙 → [02-detail-diff.md](02-detail-diff.md) §라벨 |
| 대상 | 텍스트 2줄(w-56) | `auditTableLabel(target_table)` / 아래 `target_id` | 불가 | `auditTargetHref(table, id)` 가 경로를 만들면 ID 가 링크(말줄임), 없으면 회색 텍스트. `target_table` 이 `null` 이면 `-` |
| 변경 요약 | `<details>` | `summarizeAuditDiff(before, after)` | 불가 | 접힌 상태에서 요약 + 회색 `자세히`. 펼치면 변경 전/후 JSON 2열 → [02-detail-diff.md](02-detail-diff.md) |

빈 목록 문구 `조건에 맞는 기록이 없습니다.`(`colSpan=5`).

**대상 링크 매핑**(`auditTargetHref`)

| target_table | 링크 |
|---|---|
| `gacha_items` | `/gacha/{id}`(id 없으면 `/gacha`) |
| `rankings` | `/rankings` |
| `site_settings` · `hero_banners` | `/settings` |
| `profiles` | `/members/{id}`(id 없으면 `/members`) |
| `posts` | `/community/posts` |
| `comments` | `/community/comments` |
| `inquiries` | `/inquiries/{id}`(id 없으면 `/inquiries`) |
| `faqs` | `/faqs` |
| `reports` | `/reports` |
| `admin_invites` | `/admins` |
| 그 밖(`admin_roles`·`legal_document_versions`·`coupons`·`coupon_redemptions`·`inquiry_notes`·`news_category_templates` 등) | 링크 없음 — ID 만 표시 |

## 1.3 페이지네이션

| 컨트롤 | 종류 | 제한 | 기본값 | 동작 |
|---|---|---|---|---|
| 페이지 번호 | 링크 | `totalPages(count, 50)` | 1(`parsePage`: 1 미만·숫자 아님 → 1) | `buildHref('/audit', searchParams, { page })` — **현재 필터를 모두 유지**한 채 `page` 만 바꾼다 |

**동작(서버 액션)** 이 화면에는 쓰기 액션이 없다. 기록은 각 모듈의 서버 액션이 `writeAuditLog()` 로 남긴다(→ [README](README.md) §2·§3).

**클라이언트와의 상호작용** 없음. `audit_logs` 는 사용자 사이트가 읽지 않는다.

**오류·예외**

- **필터 후보는 최근 1000건 기준**이다. 그보다 오래전에만 등장한 행위자·테이블·action 은 드롭다운에 나타나지 않는다(그 조건으로 URL 을 직접 만들면 조회는 된다).
- 조회 실패와 "정말 0건"은 화면에서 구분되지 않는다(원인은 서버 로그).
- 기간 필터는 KST 기준이다. 로그 자체는 `timestamptz` 로 저장되고 표시도 KST 다.
- 탈퇴 계정의 로그는 남지만 행위자 표시가 `(삭제된 계정)` 이 되어 **관리자 필터로는 더 이상 찾을 수 없다**(`actor_id` 가 `null`).
- 감사 로그 화면 자체를 연 기록은 남지 않는다(조회는 기록 대상이 아니다).
