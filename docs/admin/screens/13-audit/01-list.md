# 감사 로그 — 목록 (`/audit`)

**목적** 관리자의 모든 변경 이력을 조건으로 좁혀 조회한다. "누가·언제·무엇을 어떻게 바꿨는가"를 되짚는 유일한 화면이며 읽기 전용이다.

**데이터 출처** `getAuditLogs(filters)` 와 `getAuditFilterOptions()` 를 `Promise.all` 로 부른다(`admin/lib/data/audit.ts`, 세션 클라이언트 → RLS `audit_logs_select_admin`).

- 목록 질의는 `audit_logs` 에 행위자 프로필을 조인한다(`actor:profiles!audit_logs_actor_id_fkey(id, nickname, email)`).
- `count:'exact'` 로 읽고 필터를 얹은 뒤 `order('created_at', desc).order('id', desc).range()` 로 마무리한다.
- 실패 시 `console.error('[audit] 조회 실패')` 후 빈 표 · 0건이며 배너는 없다.
- 필터 후보는 최근 `OPTION_SCAN_LIMIT`(1000)건을 훑어 실제로 등장한 행위자·테이블·action 만 모은다(테이블·action 은 정렬).
- 고정 목록이면 모듈이 붙을 때마다 여기를 고쳐야 하고, 고치지 않으면 필터가 조용히 뒤처진다.

## 1.1 필터 폼 (`AuditFilters`, GET)

`<form action="/audit" method="get">` 이다. 필터 상태가 곧 URL 이라 링크로 공유하면 같은 화면이 열리고 새로고침해도 조건이 남는다.

| 필드/컨트롤 | 종류 | URL 파라미터 | 기본값 | 질의 조건 |
|---|---|---|---|---|
| 관리자 | 셀렉트 | `actor` | `전체` | `.eq('actor_id', …)` |
| 대상 테이블 | 셀렉트 | `table` | `전체` | `.eq('target_table', …)` |
| 행동 | 셀렉트 | `action` | `전체` | `.eq('action', …)` |
| 시작일 | `type="date"` | `from` | 없음 | `.gte('created_at', …)` |
| 종료일 | `type="date"` | `to` | 없음 | `.lte('created_at', …)` |
| 대상 ID | 텍스트 | `q` | 없음 | `.ilike('target_id', …)` |
| 초기화 | 링크 버튼 | — | — | 모든 조건 해제 |
| 검색 | 제출 버튼 | — | — | 폼 값 6개만 전송 |

**동작 상세**

- **관리자** 후보는 최근 1000건에 등장한 행위자이고 라벨은 `{닉네임} ({이메일 또는 -})`, 값은 uuid 다.
- **관리자** 형식 검증이 없어 이상한 값이면 결과가 0건이 된다.
- **대상 테이블** 라벨은 `auditTableLabel()` 이 한글로 옮긴다.
- **행동** 라벨은 `auditActionLabel()` 조합 표기이며 완전 일치라 접두사 검색이 되지 않는다.
- **시작일** 변환식은 `kstLocalToIso('{from}T00:00')` 로 KST 하루 경계를 만든다.
- **종료일** 변환식은 `kstLocalToIso('{to}T23:59')` 다. 그날 23:59 까지 포함해야 당일 로그가 통째로 빠지지 않는다.
- **대상 ID** `maxLength` 는 `UUID_LENGTH`(36)이고 부분 일치다.
- **대상 ID** `%` 만 이스케이프한다. `_` 는 하지 않아 한 글자 와일드카드로 동작할 수 있다.
- **대상 ID** placeholder 는 "일부만 입력해도 됩니다"이고 라벨 옆에 `현재/36` 이 표시된다.
- **초기화** `/audit` 로 이동해 페이지 번호까지 모두 버린다.
- **검색** `page` 는 폼에 없어 제출할 때마다 1페이지부터 다시 본다.
- **레이아웃** `md:grid-cols-3 lg:grid-cols-6` 이고 버튼 줄은 `lg:col-span-6` 우측 정렬이다.

## 1.2 표 (`AuditTable`)

카드 머리는 `기록 {N}건` 이고 설명은 "요약을 눌러 펼치면 변경 전후 전체를 볼 수 있습니다. 비밀번호·토큰 값은 가려집니다." 다.

공용 `<Table>` 을 쓰지 않는다 — 한 로그가 요약 줄과 펼침 영역으로 그려져야 하는데 공용 표는 행 하나에 셀 배열만 그린다. 가로 스크롤은 `min-w-[900px]` 이다.

| 열 | 값의 출처 | 표시 규칙 |
|---|---|---|
| 시각 | `created_at` | `formatDateTime`(KST), w-40 |
| 관리자 | 닉네임 / 이메일 | 2줄, w-48 |
| 행동 | `auditActionLabel(action)` | 한 줄, w-44 |
| 대상 | 테이블 라벨 / `target_id` | 2줄, w-56 |
| 변경 요약 | `summarizeAuditDiff()` | `<details>` 펼침 |

**동작 상세**

- **정렬** 항상 `created_at desc, id desc` 고정이며 정렬 변경 UI 가 없다.
- **관리자** 조인 결과가 없으면 `(삭제된 계정)` 하나만 표시하고 이메일 줄은 없다.
- **행동** 표기 규칙은 → [02-detail-diff.md](02-detail-diff.md) §라벨.
- **대상** `auditTargetHref(table, id)` 가 경로를 만들면 ID 가 링크(말줄임)가 되고, 없으면 회색 텍스트다.
- **대상** `target_table` 이 `null` 이면 `-` 를 그린다.
- **변경 요약** 접힌 상태에서 요약과 회색 `자세히` 가 보이고, 펼치면 변경 전/후 JSON 2열이 나온다.
- **빈 목록** 문구는 `조건에 맞는 기록이 없습니다.` 이고 `colSpan=5` 다.

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

- **매핑 없음** `admin_roles`·`legal_document_versions`·`coupons`·`coupon_redemptions`·`inquiry_notes`·`news_category_templates` 등은 링크 없이 ID 만 표시된다.

## 1.3 페이지네이션

| 컨트롤 | 종류 | 제한 | 기본값 | 동작 |
|---|---|---|---|---|
| 페이지 번호 | 링크 | `totalPages(count, 50)` | 1 | 현재 필터 유지 |

- **페이지 번호** `parsePage()` 가 1 미만·숫자 아님을 1 로 되돌린다.
- **페이지 번호** `buildHref('/audit', searchParams, { page })` 로 `page` 만 바꾼다.

**동작(서버 액션)** 이 화면에는 쓰기 액션이 없다. 기록은 각 모듈의 서버 액션과 DB 트리거가 남긴다(→ [README](README.md) §2·§3).

**클라이언트와의 상호작용** 없다. `audit_logs` 는 사용자 사이트가 읽지 않는다.

**오류·예외**

- 필터 후보는 최근 1000건 기준이다. 그보다 오래전에만 등장한 행위자·테이블·action 은 드롭다운에 나타나지 않는다(그 조건으로 URL 을 직접 만들면 조회는 된다).
- 조회 실패와 "정말 0건"은 화면에서 구분되지 않는다(원인은 서버 로그).
- 기간 필터는 KST 기준이다. 로그 자체는 `timestamptz` 로 저장되고 표시도 KST 다.
- 탈퇴 계정의 로그는 남지만 행위자 표시가 `(삭제된 계정)` 이 되어 관리자 필터로는 더 이상 찾을 수 없다(`actor_id` 가 `null`).
- 감사 로그 화면 자체를 연 기록은 남지 않는다(조회는 기록 대상이 아니다).
