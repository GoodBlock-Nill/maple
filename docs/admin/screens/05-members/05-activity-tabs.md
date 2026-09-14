# 활동 탭 (`/members/[id]?tab=…`)

**목적** 한 회원이 사이트에 남긴 것(글·댓글)과 신고·문의를 한 카드 안에서 훑는다. 제재를 걸기 전에 "무엇을 했는지"를 확인하는 자리다.

**데이터 출처** `MemberActivityPanel`(`admin/components/members/MemberActivityPanel.tsx`).
- 게시글·댓글은 `getMemberActivity()` 가 최근 `ACTIVITY_LIMIT = 20`건씩 `created_at desc` 로 읽는다.
- 신고·문의는 **보고 있는 탭에서만** 읽는다(`loadReports()` · `loadMemberInquiries()`, `admin/app/(admin)/members/[id]/page.tsx`).
- 탭 상태는 URL `?tab=` 이다. 조치 후 돌아왔을 때 보던 탭이 유지되고, "이 회원의 신고받은 목록"을 링크로 넘길 수 있다.

## 5.1 탭 내비게이션

| 컨트롤 | 종류 | 필수·제한(검증) | 기본값 | 동작 / 상호작용 |
|---|---|---|---|---|
| 탭 링크 5개 | `<Link>` | `ACTIVITY_TABS` 5종(아래) | `posts` | 라벨·건수·유지 규칙(아래) |

**동작 상세**
- **탭 링크 5개(필수·제한)** — `ACTIVITY_TABS` = `posts`·`comments`·`reports-made`·`reports-received`·`inquiries`. 그 밖의 값은 `posts` 로 떨어진다.
- **탭 링크 5개(동작)** — 라벨 + 건수(`toLocaleString('ko-KR')`). `buildHref(path, searchParams, { tab })` — 다른 쿼리는 유지된다. 활성 탭은 `aria-current="page"` + accent 밑줄.

| 탭 값 | 라벨 | 건수의 출처 |
|---|---|---|
| `posts` | 게시글 | `activity.postCount` |
| `comments` | 댓글 | `activity.commentCount` |
| `reports-made` | 신고함 | `activity.reportsMadeCount` |
| `reports-received` | 신고받음 | `activity.reportedCount` |
| `inquiries` | 홈페이지 문의 | `activity.inquiryCount` |

탭 라벨의 건수는 **누적 정확값**(`count: 'exact'`)이고, 표는 최근 20건(신고는 최근 활동 기준)이다. 둘이 다른 것이 정상이다.

## 5.2 게시글 탭 (`posts`)

`posts` 중 `board='community'` · `author_id = 회원`. 정렬 링크 없음(항상 작성 역순). 빈 문구 "작성한 게시글이 없습니다."

| 열 | 값의 출처 | 동작 / 상호작용 |
|---|---|---|
| 제목 | `posts.title` | 한 줄 말줄임(`line-clamp-1`). **링크 없음** — 게시글 상세는 `/community/posts` 에서 다룬다 |
| 카테고리 | `posts.category_key` | 키 원문(`chat`·`question`·`info`). 라벨로 옮기지 않는다 |
| 상태 | `is_hidden`·`deleted_at` → `contentStatus()` | 뱃지: 정상(success) / 숨김(warn) / 삭제(danger). **삭제가 숨김을 이긴다** |
| 작성일 | `posts.created_at` | `formatDateTime()` |

## 5.3 댓글 탭 (`comments`)

`comments.author_id = 회원`. 빈 문구 "작성한 댓글이 없습니다."

| 열 | 값의 출처 | 동작 / 상호작용 |
|---|---|---|
| 내용 | `comments.content` | 두 줄 말줄임(`line-clamp-2`). 링크 없음 |
| 상태 | `is_hidden`·`deleted_at` | 게시글 탭과 같은 뱃지 |
| 작성일 | `comments.created_at` | `formatDateTime()` |

## 5.4 신고함 / 신고받음 탭 (`reports-made` · `reports-received`)

두 탭은 **같은 표**를 쓴다(필터만 다르다 — 표기가 갈리지 않게 하려는 것).
- 신고함: `getReportsFor({ reporterId })` — 최근 20건.
- 신고받음: `getReportsFor({ targetIds: [...게시글 20건 id, ...댓글 20건 id] })` — `reports` 에 작성자 컬럼이 없어 대상 id 로 되짚는다. **최근 활동 40건만 훑으므로 지표 카드의 누적 "받은 신고"보다 적게 나올 수 있다.**
- 빈 문구: 신고함 "접수한 신고가 없습니다." / 신고받음 "받은 신고가 없습니다."

| 열 | 값의 출처 | 동작 / 상호작용 |
|---|---|---|
| 대상 | `reports.target_type` + 대상 본문 | 뱃지·발췌·빈 값 표시(아래) |
| 사유 | `reports.reason` | `REPORT_REASON_LABEL` 5종·문구 일치 요구(아래) |
| 신고자 | `profiles!reports_reporter_id_fkey.nickname` | 프로필을 못 읽으면 "(탈퇴)" |
| 상태 | `reports.status` | 뱃지: 미처리(warn) / 처리 완료·기각(neutral) — `REPORT_STATUS_LABEL` |
| 신고일 | `reports.created_at` | `formatDateTime()` |

신고를 여기서 처리할 수는 없다(처리·기각은 `/reports`).

**동작 상세**
- **대상** — 뱃지(accent) "게시글"/"댓글"(`REPORT_TARGET_LABEL`) + 발췌 60자(`excerpt()`). 대상을 못 읽으면 "(대상 없음)".
- **사유** — `REPORT_REASON_LABEL` — 스팸·광고 / 욕설·비방 / 음란·불쾌 / 개인정보 노출 / 기타. **사용자 사이트의 신고 다이얼로그 문구와 글자까지 같아야 한다**.

## 5.5 홈페이지 문의 탭 (`inquiries`, `MemberInquiriesTab`)

`inquiries.user_id = 회원` **and** `cancelled_at is null`, 최근 `ACTIVITY_LIMIT = 20`건.

| 상태 | 화면 |
|---|---|
| `inquiries:read` 없음 | 표 대신 안내 한 줄 "문의 조회 권한이 없습니다."(아래) |
| 조회 실패 | 표 위에 `FormBanner`(`LIST_LOAD_ERROR`) |
| 0건 | "접수한 문의가 없습니다." |

- **`inquiries:read` 없음** — 조회 자체를 건너뛴다 — 빈 표와 권한 없음이 구분되어야 한다.

| 열 | 값의 출처 | 동작 / 상호작용 |
|---|---|---|
| 접수번호 | `inquiries.inquiry_no` | `formatInquiryNo()`, 모노스페이스·`tabular-nums`. 같은 자리·표기 규칙(아래) |
| 종류 | `inquiries.kind` | 뱃지(neutral) `INQUIRY_KIND_MAP[kind].label`. 경계 처리 규칙(아래) |
| 제목 | `inquiries.title` | `/inquiries/{id}` 로 링크(관리자 문의 상세). 한 줄 말줄임 |
| 카테고리 · 유형 | `inquiries.category` · `type` | `inquiryCategoryLabel()` · `inquiryTypeLabel()` 을 ` · ` 로 이어 붙인다 |
| 상태 | `inquiries.status` · `cancelled_at` | `InquiryStatusBadge` |
| 답변 | 임베드 집계 `inquiry_replies(count)` | 우측 정렬. 0이면 흐린 색 |
| 접수일 | `inquiries.created_at` | `formatDateTime()` |

| 컨트롤 | 조건 | 동작 |
|---|---|---|
| 전체 보기 | `activity.inquiryCount > 표시된 행 수` 일 때만 | `/inquiries?user={회원id}` 로 이동 — 문의 목록을 이 회원으로 좁혀 연다 |

**동작 상세**
- **접수번호** — `formatInquiryNo()`, 모노스페이스·`tabular-nums`. 문의 목록과 **같은 자리·같은 표기**(두 화면을 번호로 대조한다).
- **종류** — CHECK 제약이 타입에 없어 경계에서 `isInquiryKind()` 로 좁히고, 모르면 `DEFAULT_INQUIRY_KIND`.

## 상태·뱃지 의미

| 뱃지 | 값 → 라벨 | 색 | 언제 |
|---|---|---|---|
| 콘텐츠 상태 | `visible` → 정상 | success | `is_hidden=false` and `deleted_at is null` |
| | `hidden` → 숨김 | warn | 운영 숨김 |
| | `deleted` → 삭제 | danger | 작성자 삭제(`deleted_at`). 숨김과 동시 서도 삭제 우선(아래) |
| 신고 상태 | `open` → 미처리 | warn | 아직 처리되지 않음 |
| | `resolved`/`dismissed` → 처리 완료/기각 | neutral | 종결 |
| 대상 종류 | `post`/`comment` → 게시글/댓글 | accent | 항상 |

- **`deleted`(삭제)** — 숨김과 동시에 서 있어도 삭제로 표시 — 그렇지 않으면 운영자가 복구를 눌러도 글이 돌아오지 않는 것처럼 느낀다.

## 클라이언트와의 상호작용

- 게시글·댓글 탭의 "숨김"은 운영자가 `/community/posts`·`/community/comments`(또는 신고 처리)에서 건 것이다. 사용자 사이트에서 그 글은 목록·상세에서 빠진다.
- 신고함 탭의 행은 **사용자가 사이트에서 접수한 것**이다(`components/board/ReportDialog.tsx` → `lib/actions/report-actions.ts`). 정지 중인 회원은 신고를 새로 남길 수 없다(RLS `reports_insert_own` 의 `not is_suspended()`).
- 홈페이지 문의 탭의 행은 `/support` 에서 접수된다. 사용자가 취소한 문의(`cancelled_at`)는 사용자·관리자 목록과 이 탭에서 **모두** 빠지므로, 사용자가 "냈는데 없다"고 하면 취소 여부를 먼저 확인한다.
- 이 화면에는 쓰기 액션이 없다 — 캐시 재검증도 없다.

## 오류·예외

- 신고받음 탭은 **최근 활동 40건(게시글 20 + 댓글 20)** 만 훑는다. 오래된 글에 달린 신고는 탭에 나오지 않지만 지표 카드에는 세어진다.
- 신고 임베드는 FK 힌트가 필수다(`profiles!reports_reporter_id_fkey`). 힌트가 없으면 PostgREST 가 "more than one relationship was found" 로 반려해 목록이 통째로 빈다(`reports.reporter_id` · `resolved_by` 둘 다 `profiles` 를 가리킨다).
- 신고·게시글·댓글 조회 실패에는 배너가 없다 — 빈 표로 보인다(문의 탭만 `hasError` 배너를 갖는다).
- `?tab=` 에 모르는 값이 오면 조용히 게시글 탭이 열린다(오류 표시 없음).
