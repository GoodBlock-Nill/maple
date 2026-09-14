# 홈페이지 문의 목록 (`/inquiries?source=web`)

> 07 고객지원 › 목록. 메뉴 공통 규칙(종류·상태·권한·캐시)은 [README.md](README.md) 참고.

**목적** 사용자 사이트 세 창구(1:1 문의 · 버그제보 · 불법이용제보)로 접수된 문의를 훑고, 담당자·상태로 좁혀 처리할 한 건을 고른다. 운영자가 매일 처음 여는 화면이라 기본 탭이 '미처리'다.

**데이터 출처**
- 페이지: `admin/app/(admin)/inquiries/page.tsx`, `export const dynamic = 'force-dynamic'`(캐시된 목록은 "방금 온 문의가 없다"는 오해를 부른다).
- 가드: `requirePermission('inquiries', 'read')` — 반환된 `admin.id` 가 '내 담당' 필터와 목록의 담당자 표시에 쓰인다.
- 목록: `getInquiries(filters, { page, sortKey, ascending, viewerId })` (`admin/lib/data/inquiries.ts`). `inquiries` 를 세션 클라이언트로 `select(LIST_COLUMNS, { count: 'exact' })` → `.in('status', filters.statuses)` → `applyInquiryFilters()` → `.order(sortKey)` → `.order('id', asc)`(안정 정렬) → `.range()`. 본문(`content`)은 **읽지 않는다**(검색은 서버 ilike).
- 탭 건수: `getInquiryTabCounts(filters, viewerId)` — 탭 수만큼 `head: true` 질의를 병렬로 던지고, 상태 외 조건은 목록과 **같은 함수**(`applyInquiryFilters`)를 쓴다.
- 옵션: `getInquiryCategoryFilterOptions(kind)` · `getInquiryTypeFilterOptions(category, kind)` (`admin/lib/data/inquiry-categories.ts`), `getAdmins()` (`admin/lib/data/admins.ts`, `profiles.role='admin'` 전원), `?user=` 가 있으면 `getMember(userId)`.
- 페이지 크기 `DEFAULT_PAGE_SIZE = 20`, 기본 정렬 `created_at:desc`.
- 조회 실패: `hasError=true` → 표 위에 `FormBanner`(`LIST_LOAD_ERROR`: "목록을 불러오지 못했습니다. 표가 비어 보이는 것은 데이터가 없어서가 아닙니다. 새로고침해 주세요.").

## 1. 페이지 헤더

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값·프리필 | 동작 / 상호작용 |
|---|---|---|---|---|
| 제목 | 텍스트 | — | `PRESETS[source].title` = "홈페이지 문의"(`?source=web`) · "문의 전체"(`source` 없음) | `generateMetadata` 도 같은 값을 쓴다 |
| 설명 | 텍스트 | — | 페이지 설명 문구(아래) | — |
| 카테고리 관리 | 버튼(secondary) | 권한과 무관하게 노출 | — | `/inquiries/categories` 로 이동([06-categories.md](06-categories.md)) |
| 회원 필터 뱃지 | 뱃지(accent) + 링크 | `?user=` 가 uuid 일 때만 | 닉네임, 조회 실패 시 "(탈퇴한 회원)" | 스코프 출처·해제 링크(아래) |

**동작 상세**
- **설명** — "홈페이지(1:1 문의 · 버그제보 · 불법이용제보)로 접수된 문의를 확인하고 답변합니다. 기본 화면은 아직 처리하지 않은 문의입니다."
- **회원 필터 뱃지** — 회원 상세의 "전체 보기"가 붙여 주는 스코프. "해제" → `buildHref('/inquiries', params, { user: null })`.

## 2. 상태 탭 (`?status=`)

`INQUIRY_STATUS_TABS` 를 `<Link>` 로 그린다(자바스크립트 없이 동작). 링크는 `buildHref(..., { status: tab.value, page: null })` — 탭을 바꾸면 페이지 번호는 버린다. 잘못된 값은 `parseInquiryStatusTab()` 이 기본 탭으로 떨어뜨린다.

| 탭 | `?status=` | 질의 조건 | 기본값 |
|---|---|---|---|
| 미처리 | `open` | `status in (pending, in_progress)` | **기본**(`DEFAULT_INQUIRY_STATUS_TAB`) |
| 접수 대기 | `pending` | `status = pending` | — |
| 처리 중 | `in_progress` | `status = in_progress` | — |
| 답변 완료 | `answered` | `status = answered` | — |
| 종료 | `closed` | `status = closed` | — |
| 접수 취소 | `cancelled` | 상태 전체 + `cancelled_at is not null` | — |
| 전체 | `all` | 상태 전체 | — |

- **취소분은 '접수 취소' 탭에서만 보인다.** 다른 탭은 `applyInquiryFilters` 가 `cancelled_at is null` 을 건다(오너 결정, 2026-09-11) — 사용자 목록에서 사라진 문의가 '종료'·'전체'에 남으면 두 화면의 뜻이 어긋난다.
- 탭 옆 숫자는 **지금 걸린 다른 필터가 모두 적용된** 건수다.
- 활성 탭은 `aria-current="page"` + accent 배경.

## 3. 필터 폼 (GET)

`<form action="/inquiries" method="get">`. 값이 그대로 쿼리 키가 되므로 새로고침·뒤로가기·링크 공유가 같은 화면을 낸다. 파싱은 전부 `parseInquiryFilters()`(`admin/lib/validation/inquiries.ts`).

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값·프리필 | 동작 / 상호작용 |
|---|---|---|---|---|
| `status` | hidden | — | 현재 탭 | 조건을 바꿔도 탭을 잃지 않는다 |
| `source` | hidden | — | 현재 프리셋(`web`) | 출처를 select 로 두지 않는 이유(아래) |
| `sort` | hidden | — | 주소에 실려 온 값 | 조건을 바꿔도 정렬 유지. `page` 는 **일부러 싣지 않는다** |
| `user` | hidden | uuid 모양만(`parseUserIdParam`) | `?user=` | 회원 스코프 유지 |
| 담당자 | select `assignee` | `me` · `none` · uuid 만 인정, 그 밖은 전체 (`parseInquiryAssignee`) | `전체`(빈 값) | 값별 질의 조건(아래) |
| 회원 답장 도착만 | checkbox `awaiting`, value `1` (`InquiryAwaitingFilter`) | 값 판정 규칙(아래) | 꺼짐 | 질의 조건·탭 공유(아래) |
| 종류 | select `kind` | `inquiry`·`bug`·`report` 밖이면 전체(`isInquiryKind`) | `전체` | `kind` 컬럼 eq. 바꾸면 **다음 왕복**에서 카테고리·유형 선택지도 그 창구 것만 남는다 |
| 카테고리 | select `category` | 1~20자(`sanitizeInquiryCategory`, DB `inquiry_categories_label_length` 와 같은 숫자). 초과·빈 값 → 전체 | `전체` | 질의 조건·선택지 구성(아래) |
| 유형 | select `type` | 1~30자(`sanitizeInquiryType`, DB `inquiry_categories_subtypes_shape` 와 같은 숫자) | `전체` | 질의 조건·선택지 규칙(아래) |
| 등록일 시작 | `input[type=date]` `from`, aria-label "시작일" | `YYYY-MM-DD` 정규식 + 파싱 가능해야 함 | 비움 | `created_at >= {from}T00:00:00+09:00` |
| 등록일 종료 | `input[type=date]` `to`, aria-label "종료일" | 위와 같음 | 비움 | `created_at < {to+1일}T00:00:00+09:00` — "~까지"에 그날 24시를 포함한다 |
| 검색 | `input[type=search]` `q`, maxLength 60 | 서식 문자 `,()%_*\"'` 는 공백으로 치환 후 공백 축약·trim·60자 절단(`sanitizeInquirySearch`) | 비움. placeholder "제목 · 내용 · 계정 ID · 발신자 주소" | 검색 대상 컬럼·접수번호 매칭(아래) |
| 검색 | 버튼(submit) | — | — | 폼 제출 = 주소 갱신 |
| 초기화 | 버튼(secondary, 링크) | — | — | 유지·초기화 대상(아래) |

**동작 상세**
- **`source`** — 출처는 고르는 값이 아니라 "이 화면이 어느 메뉴인가"다. select 를 두지 않는다(2026-09-11 오너 결정).
- **담당자** — `me` → `assigned_to = viewerId`, `none` → `assigned_to is null`, uuid → `assigned_to = uuid`. 선택지는 관리자 전원의 닉네임.
- **회원 답장 도착만(필수·제한)** — 값은 **`'1'` 하나만** 참으로 읽는다(`parseInquiryAwaitingParam`) — 체크박스는 꺼지면 아무것도 보내지 않는다.
- **회원 답장 도착만(동작)** — `user_replied_at is not null`(2026-09-14). 목록과 탭 건수가 `applyInquiryFilters()` 하나를 공유해 체크 한 번으로 탭 숫자도 함께 좁혀진다.
- **카테고리** — `category` 컬럼 eq(라벨 문자열 비교). 선택지 = 그 창구의 등록 카테고리(비활성 포함) + **데이터에만 남은 옛 라벨**(`inquiry_category_usage()` 집계에서 뽑아 정렬).
- **유형** — `type` 컬럼 eq. **선택지가 0개면 컨트롤 자체를 그리지 않는다.** 카테고리를 고르면 그 카테고리의 `subtypes` 만, 안 고르면 그 창구 전체 + 옛 유형.
- **검색** — `or(title.ilike, content.ilike, account_id.ilike, email_from.ilike)`. 검색어가 `1024`/`#1024` 모양(숫자 15자리 이하, >0)이면 `inquiry_no.eq.N` 을 **추가로** or 한다(`parseInquiryNoSearch`).
- **초기화** — `buildHref('/inquiries', {}, { status, source, user, kind, awaiting })` — **탭·출처·회원 스코프·종류·회원 답장 도착만은 남기고** 담당자·카테고리·유형·기간·검색·정렬·페이지만 지운다(2026-09-14, "회원 답장 도착만"은 검색 조건이 아니라 지금 보고 있는 묶음이라 종류와 같은 취급).

## 4. 표 (`InquiryTable`)

`caption="문의 목록"`, 비어 있으면 "조건에 맞는 문의가 없습니다.". 칸마다 최소 폭이 있고, 넘치면 컨테이너가 가로 스크롤한다. **출처(웹·이메일) 칸은 두지 않는다** — 사이드바가 이미 갈라 놓은 값이다.

| 열 | 값의 출처 | 정렬 | 표시 규칙 |
|---|---|---|---|
| 접수번호 | `inquiries.inquiry_no` | 불가 | `formatInquiryNo()` → `#1024`. 값이 없으면 `-`. 모노스페이스·tabular-nums |
| 종류 | `inquiries.kind` | 불가 | `Badge tone="neutral"` + `INQUIRY_KIND_MAP[kind].label` |
| 제목 | `inquiries.title` | `?sort=title:asc|desc` | `/inquiries/[id]` 링크, 한 줄 말줄임 |
| 계정 | `profiles.nickname` + `inquiries.account_id` | 불가 | 표시 규칙(아래) |
| 카테고리 · 유형 | `category` · `type` | 불가 | `inquiryCategoryLabel()`·`inquiryTypeLabel()` 로 표시 치환(`email`→이메일, `general`→일반) 후 `A · B` |
| 담당자 | `assigned_to` + 임베드 `profiles` | 불가 | 표시 규칙(아래) |
| 상태 | `status` + `cancelled_at` | `?sort=status:…` | `InquiryStatusBadge` — 취소가 상태보다 우선 |
| 답변 | 임베드 `inquiry_replies(count)` | 불가 | 우측 정렬. 0 이면 흐린 글자 |
| 등록일 | `created_at` | `?sort=created_at:…`(**기본** desc) | `formatDateTime()` |
| 업데이트 | `updated_at` | `?sort=updated_at:…` | `formatRelativeDay()`(오늘이면 시:분) |

**동작 상세**
- **계정** — 닉네임(끊긴 `user_id` 는 "(탈퇴한 회원)") 아래 `maskAccountId()` — `1234****000`, 7자 이하면 `1****`, 없으면 `-`.
- **담당자** — 미배정이면 `Badge tone="warn"` "미배정", 아니면 닉네임(임베드가 비면 "(탈퇴한 관리자)"). 아래 줄에 "작성 중 · {닉네임}"(연필 아이콘, `data-testid="inquiry-editing"`, `title="… 관리자가 답변을 작성하고 있습니다"`).

- 정렬 헤더 링크: `sortHref()` — 같은 키를 다시 누르면 desc↔asc 를 뒤집고, 다른 키면 desc 로 시작한다. **정렬이 바뀌면 항상 1페이지로 돌아간다.**
- 허용 정렬 키는 `INQUIRY_SORT_KEYS = ['created_at','updated_at','status','title']`. 그 밖은 기본값.
- 페이지네이션: `totalPages(count, 20)`, 링크는 `?page=N`(1 미만·비정수는 1).

## 5. 상태·뱃지 의미

| 뱃지 | 값 | 톤 | 언제 |
|---|---|---|---|
| 접수 대기 / 처리 중 / 답변 완료 / 종료 | `inquiries.status` | neutral / info-blue / success-green / muted | 항상 |
| 접수 취소 | `cancelled_at is not null` | muted | 상태 라벨보다 우선 |
| 미배정 | `assigned_to is null` | warn | 목록에서 가장 먼저 눈에 띄어야 하는 값이라 흐린 글씨가 아니라 경고 뱃지다 |
| 작성 중 · {닉네임} | `editing_by` + `editing_at` 이 5분 이내(`isLiveLock`) | warn 글자 | 담당자와 **다른 사람**일 수 있어 담당자 값과 겹치지 않고 아래 줄에 나란히 둔다 |
| 종류 뱃지 | `kind` | neutral | 세 창구가 한 표에 섞이므로 제목보다 앞 |
| 회원 답장 | `inquiries.user_replied_at is not null`(2026-09-14) | warn | 표시 위치·소멸 조건(아래) |

- **회원 답장** — 상태 뱃지 옆에 붙는다(`InquiryMemberReplyBadge`). 값이 있으면 회원이 마지막으로 답한 것 — 운영자가 다시 답하면 트리거가 지운다.

색은 사용자 사이트(`lib/constants/inquiry-status.ts`)의 상태 색과 같은 뜻을 쓰도록 맞춰 둔다 — 운영자가 화면을 보며 사용자에게 상태를 설명할 수 있어야 한다.

## 6. 클라이언트와의 상호작용

- 접수: 사용자가 `/support`(1:1 문의) · `/support/bug` · `/support/report` 에서 낸 문의가 **즉시** 이 목록에 나타난다. 세 라우트는 `components/support/InquiryKindPage` 하나를 kind 만 바꿔 그리고, 카테고리·프리필·세부 유형은 `inquiry-categories` 캐시에서 읽는다([06-categories.md](06-categories.md)).
- 캐시 없음: 이 화면은 `force-dynamic` 이고 RLS `inquiries_select_admin` 이 관리자에게만 전체 조회를 연다. 권한이 사라지면 화면도 함께 빈다.
- 취소: 사용자가 `/support/inquiries/[id]` 에서 접수 취소(`cancelInquiry`)하면 사용자 목록에서 사라지고, 이 목록에서도 '접수 취소' 탭으로만 이동한다.
- 회원 상세 연동: `/members/[id]` 활동 탭의 "전체 보기"가 `?user=<id>` 로 들어온다. 회원 탭 자체는 `getMemberInquiries()`(`admin/lib/data/member-inquiries.ts`)가 최근 `ACTIVITY_LIMIT` 건만 읽고, **취소분을 제외**해 이 목록과 같은 규칙을 유지한다.
- 관리자만 보는 값: 담당자, 작성 중 잠금, 내부 메모, 계정 ID 원문(마스킹해도 사용자 화면에는 아예 없다), 이메일 인증 판정.
- 회원 답장(2026-09-14): 사용자가 상세(`/support/inquiries/[id]`)에서 답장을 보내면(처리 중 · 운영자 답변 후에만 가능) `user_replied_at` 이 찍혀 이 목록·회원 상세에 "회원 답장" 뱃지가 **즉시** 붙는다. `?awaiting=1` 로 그 문의들만 걸러 볼 수 있다.

## 7. 오류·예외

| 상황 | 결과 |
|---|---|
| 목록 질의 실패 | `rows=[] / hasError=true` → 상단 `LIST_LOAD_ERROR` 배너(아래) |
| 탭 건수 질의 실패 | 그 탭만 `0` 으로 표시(배너 없음) |
| 카테고리·유형 옵션 집계 실패 | 빈 Map → 옛 라벨이 선택지에서 사라진다(등록 카테고리만 남는다) |
| `?assignee=` 가 uuid 모양이 아님 | 필터를 걸지 않는다(= 전체). 임의 문자열이 `eq()` 로 흘러가지 않게 |
| `?category=`/`?type=` 이 상한 초과 | 전체로 떨어뜨린다(어떤 행과도 맞지 않아 필터로 의미가 없다) |
| `?sort=` 이 허용 키 밖 | `created_at:desc` |
| `?page=` 가 0·음수·문자 | 1 |
| `?user=` 회원이 탈퇴 | 뱃지에 "(탈퇴한 회원)" — 필터는 그대로 걸린다 |
| 담당자 임베드가 비어 있음 | "(탈퇴한 관리자)" — "담당자가 있다"는 사실까지 지우면 미배정과 구분되지 않는다 |
| `kind` 가 CHECK 밖의 값 | `DEFAULT_INQUIRY_KIND` 라벨("1:1 문의")로 표시 |

- **목록 질의 실패** — `console.error('[inquiries] 목록 조회 실패', …)` 로도 남는다(빈 표 오독 방지).
