# 뉴스 목록 (`/news`)

**목적** 뉴스 게시글을 카테고리·상태·고정·검색어로 추려 보고, 숨김·삭제·복구로 노출을 관리한다. 새 글 작성과 카테고리 템플릿 관리로 들어가는 입구이기도 하다.

**데이터 출처**
- `listNews({ category, status, pinned, q, sort, page })` (`admin/lib/data/news.ts`) — 세션 클라이언트(서비스 롤 아님)로 `posts` 를 `board='news'` 로 좁혀 읽는다. 임시저장·예약·숨김·삭제까지 보이는 근거는 RLS `posts_select_admin`(`is_admin()`) 하나뿐이라, 권한이 사라지면 목록도 비어야 한다.
- 페이지 크기 `DEFAULT_PAGE_SIZE = 20`(`admin/lib/utils/table-query.ts`), 기본 정렬 `NEWS_DEFAULT_SORT = { key: 'published_at', direction: 'desc' }`.
- `listNewsCategories()` — 필터 select 의 옵션(`board_categories` where `board='news'` and `is_active`, `sort_order` asc).
- `getPinnedNewsSummary()` — 상단 "고정 x/3" 표시용. `excludeId` 없이 부른다.
- `export const dynamic = 'force-dynamic'` — 조치 직후 상태를 그대로 보여 줘야 하므로 매 요청 새로 읽는다.
- 조회 실패 시: `listNews` 가 `{ items: [], total: 0, hasError: true }` 를 돌려주고 표 위에 `FormBanner`(문구 `LIST_LOAD_ERROR` — "목록을 불러오지 못했습니다. 표가 비어 보이는 것은 데이터가 없어서가 아닙니다. 새로고침해 주세요.")가 뜬다. 고정 집계만 실패하면 "고정 ?/3" 으로 찍힌다.

## 1.1 헤더 · 액션 버튼
| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값·프리필 | 동작 / 상호작용 |
|---|---|---|---|---|
| 제목 | `PageHeader` | — | "뉴스" | 설명 고정 문구 "뉴스 게시글을 작성·수정하고 발행 상태를 관리합니다." |
| 카테고리 템플릿 | 링크 버튼(secondary) | `news:write` 에만 노출 | — | `/news/templates` 로 이동 → [04-templates.md](04-templates.md) |
| 새 뉴스 작성 | 링크 버튼(primary) | `news:write` 에만 노출 | — | `/news/new` 로 이동 → [03-new.md](03-new.md) |

## 1.2 필터 폼 (`NewsFilters`)
상태를 갖지 않는 **GET 폼**(`method="get" action="/news"`, `role="search"`). 제출하면 브라우저가 쿼리스트링을 다시 써서 새로고침·뒤로가기·링크 공유가 같은 화면을 재현한다. `sort` 는 숨은 필드로 보존하고 **`page` 는 일부러 싣지 않는다**(조건이 바뀌면 3페이지는 의미를 잃는다).

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값·프리필 | 동작 / 상호작용 |
|---|---|---|---|---|
| 정렬 보존 | hidden input `sort` | — | `serializeSort(sort)` = `published_at:desc` 등 | 필터를 바꿔도 정렬이 풀리지 않게 실어 보낸다 |
| 카테고리 | `Select` `name="category"` (폭 w-40) | 목록은 `listNewsCategories()`. 잘못된 값은 `isNewsCategoryKey()` 에서 걸려 필터 없음으로 떨어진다 | placeholder "전체", 현재 `?category=` | `onChange` 에서 폼 즉시 제출(`requestSubmit()`). 서버: `query.eq('category_key', …)` |
| 상태 | `Select` `name="status"` (폭 w-44) | `NEWS_STATUSES` 5종. 모르는 값 → 전체 | placeholder **"전체(삭제 제외)"**, 현재 `?status=` | `onChange` 즉시 제출. 서버 `applyNewsStatusFilter()` 가 아래 표대로 조건을 건다 |
| 고정 | `Select` `name="pinned"` (폭 w-32) | 옵션은 `1`(라벨 "고정만") 하나. `parseNewsPinnedFilter()` 가 `z.enum(['0','1'])` 로 파싱, 그 밖은 false | placeholder "전체", `?pinned=1` 이면 선택됨 | `onChange` 즉시 제출. 서버 조건(아래) |
| 검색 | `Input type="search"` `name="q"` (폭 w-64) | `maxLength = SEARCH_MAX_LENGTH(60)`, 라벨 옆에 `현재/최대` 카운트 | placeholder "제목 · 요약", 현재 `?q=` | Enter/"검색" 버튼 제출. 서버 조건(아래) |
| 검색(버튼) | submit 버튼 | — | — | 폼 제출 |
| 초기화 | 링크 버튼(ghost) | `isFiltered`(카테고리·상태·고정·검색어 중 하나라도 있음)일 때만 보인다 | — | `/news` 로 이동 — **정렬·페이지까지 전부 지운다** |

**동작 상세**
- **고정** — `onChange` 즉시 제출. 서버 `query.eq('is_pinned', true)`. **상태 필터와 별개 축**이라 "숨김이면서 고정"도 걸러진다.
- **검색** — Enter 또는 "검색" 버튼으로 제출. 서버 `or(title.ilike.%p%,summary.ilike.%p%)` — **제목과 요약을 함께** 찾는다.

**상태 필터 → 질의 조건** (`applyNewsStatusFilter()`, 판정 기준이 `deriveNewsStatus()` 와 같아야 뱃지와 필터 결과가 어긋나지 않는다)

| `?status=` | 조건 |
|---|---|
| 없음(전체) | `deleted_at is null` — **삭제된 글은 기본 목록에서 빠진다** |
| `hidden` | `deleted_at is null and is_hidden = true` |
| `draft` | `deleted_at is null and is_hidden = false and is_published = false` |
| `scheduled` | 위 + `is_published = true and published_at > now()` |
| `published` | 위 + `is_published = true and published_at <= now()` |
| `deleted` | `deleted_at is not null` (다른 조건 없음) |

**검색어 정규화** (`containsPattern()`): `\` `%` `_` 는 이스케이프(LIKE 와일드카드), `,` `(` `)` `"` 는 공백으로 치환(PostgREST `or=(...)` 구분자 — 검색어 하나로 목록이 500 이 되는 것을 막는다). 정리 후 빈 문자열이면 검색 조건 자체를 걸지 않는다.

## 1.3 요약 줄
표 바로 위 한 줄(`text-[12px]`).

| 필드 | 값의 출처 | 표시 규칙 |
|---|---|---|
| 총 N건 | `listNews().total` (`count: 'exact'`) | `toLocaleString('ko-KR')`. **필터가 적용된 건수**다 |
| 고정 x/3 | `getPinnedNewsSummary().count` / `NEWS_PIN_LIMIT` | 집계 실패면 `?/3` |
| 삭제 안내 | — | `status === null`(전체)일 때만 표시(아래) |

**동작 상세**
- **삭제 안내** — `status === null`(전체)일 때만 덧붙는다: `· 삭제된 글은 상태 필터에서 "삭제"를 골라야 보입니다.`

## 1.4 일괄 처리 바 (`NewsTable` → `NewsBulkBar`, `news:write` 전용)
표 전체가 하나의 `<form>` 이다. 체크박스가 `ids` 반복 필드로 모이고, 제출 버튼의 `name="intent"`/`value` 가 함께 FormData 에 담긴다. `aria-live="polite"` 로 선택 개수 변화를 읽어 준다. 버튼 줄만 `NewsBulkBar`(`admin/components/news/NewsBulkBar.tsx`)로 떼어 두었다 — 선택 상태와 액션 호출은 `NewsTable` 에 남는다.

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값·프리필 | 동작 / 상호작용 |
|---|---|---|---|---|
| N건 선택 | 텍스트 | — | `0건 선택` | 컴포넌트 상태 `selected` 의 길이 |
| 선택 숨김 | submit 버튼(secondary sm) `name="intent" value="hide"` | 고른 것 중 **발행**이 0건이거나 처리 중이면 `disabled`(아래) | — | `newsStateAction(intent='hide')` 실행(아래) |
| 선택 숨김 해제 | submit 버튼(secondary sm) `name="intent" value="unhide"` | 고른 것 중 **숨김**이 0건이거나 처리 중이면 `disabled`(아래) | — | `newsStateAction(intent='unhide')` 실행(아래) |
| 발행 N건 · 숨김 M건 | 텍스트(muted, `text-[12px]`) | 선택 0건이면 아예 그리지 않는다 | — | 두 버튼이 각각 실제로 처리할 건수(아래) |
| 선택 삭제 | 버튼(danger sm) | 선택 0건·처리 중이면 `disabled` | — | 확인 다이얼로그를 연다(아래) |

**동작 상세**
- **선택 범위** — 선택은 **현재 페이지(최대 20건)** 안에서만 된다. 페이지를 넘기면 선택이 초기화되고, "필터에 맞는 전체 선택"(여러 페이지)은 지원하지 않는다 — 1회 일괄 처리 상한이 곧 20건이라 서버에 별도 상한을 두지 않는다(결정 2026-09-15, 현재 상태 유지).
- **선택 숨김** — `newsStateAction(intent='hide')` → **발행 상태인 행만** `posts.is_hidden = true` (여러 건 한 질의) → 감사 `news.hide` ×처리 건수 → `revalidatePath('/news')` + 태그 `news-list` → 성공 토스트 후 선택 해제.
- **선택 숨김 해제** — `newsStateAction(intent='unhide')` → **숨김 상태인 행만** `posts.is_hidden = false` (여러 건 한 질의) → 감사 `news.unhide` ×처리 건수 → `revalidatePath('/news')` + 태그 `news-list` → 성공 토스트 후 선택 해제.
- **숨김 대상** — 숨김은 발행(`published`) 상태에만, 해제는 숨김(`hidden`) 상태에만 건다. 임시저장·예약 글은 독자에게 이미 보이지 않아 숨길 것도 되돌릴 것도 없다. 버튼이 열려 있는지는 화면이 판단하지만 최종 판정은 서버 액션이 다시 한다 → [1.8](#18-상태-변경-액션-계약-newsstateaction).
- **발행 N건 · 숨김 M건** — `countEligible(rows, selected)`(`admin/lib/validation/news-state-eligibility.ts`)를 `useMemo` 로 한 번 불러 두 수를 함께 센다. 20건을 골라도 3건만 처리된다는 것을 누르기 **전에** 알리려는 표시다. `aria-live="polite"` 영역 안이라 선택이 바뀌면 함께 읽힌다.
- **두 수를 함께 세는 이유** — 같은 선택에서 나온 값이어야 두 버튼의 활성 여부와 안내 문구가 서로 어긋나지 않는다. 숨김과 해제는 각각 따로 센다 — 겹치지 않는 것은 현재 규칙이 그런 것일 뿐이라, 한쪽을 다른 쪽의 여집합으로 두면 규칙이 바뀌는 날 조용히 틀린 수가 찍힌다.
- **성공 토스트** — 고른 것이 전부 대상이면 `"N건을 숨겼습니다."` / `"N건을 숨김을 해제했습니다."`, 일부만 대상이면 사유가 붙는다(아래).
- **일부만 대상일 때** — 숨김은 `"2건을 숨겼습니다. 발행되지 않은 1건은 제외했습니다."`, 해제는 `"2건을 숨김을 해제했습니다. 숨김이 아닌 1건은 제외했습니다."`.
- **해제가 고정 한도를 넘길 때** — 숨긴 고정 글을 되돌리면 상단 고정이 3개를 넘을 수 있다. DB 트리거 `guard_news_pin_limit` 가 막고, 이 화면에는 고정 체크박스가 없어 `NEWS_PIN_LIMIT_MESSAGE` 를 `formError` 로 받아 에러 토스트로 보여 준다 → [1.8](#18-상태-변경-액션-계약-newsstateaction).
- **선택 삭제** — 확인 다이얼로그를 연다. 폼 제출이 아니라 `useTransition` 으로 직접 호출(다이얼로그 버튼이 표 밖에 있어도 선택이 실린다). 삭제는 상태를 가리지 않는다.

**선택 삭제 확인 다이얼로그**
| 요소 | 문구 |
|---|---|
| 제목 | `뉴스 삭제` |
| 설명 | `선택한 {N}건을 삭제합니다. 목록의 상태 필터에서 삭제를 골라 복구할 수 있습니다.` |
| 본문 | `삭제해도 데이터는 남습니다(소프트 삭제). 사용자 사이트에서는 즉시 사라집니다.` |
| 버튼 | `취소` / `삭제`(처리 중 `삭제 중…`) |
| 확정 시 | 아래 |

- **확정 시** — `newsStateAction(intent='delete')` → `posts.deleted_at = now()` → 감사 `news.delete` ×N → 태그 `news-list` → 토스트 `"N건을 삭제했습니다."` → 선택 해제 + 다이얼로그 닫힘.

## 1.5 표 (`NewsTable` + `buildNewsColumns`)
`caption="뉴스 목록"`, 빈 결과 문구 `"조건에 맞는 뉴스가 없습니다."`. 정렬 링크는 서버에서 미리 만들어 내려준다(`sortHrefs` — 함수는 서버→클라이언트 경계를 넘지 못한다).

| 열 | 종류 | 정렬 | 값의 출처 | 동작 / 표시 규칙 |
|---|---|---|---|---|
| 선택 | 체크박스 `name="ids" value={id}` (폭 w-10) | — | 컴포넌트 상태 | 헤더는 "전체 선택"(현재 페이지 20건 기준 토글). **`news:write` 가 없으면 열 자체가 빠진다** |
| 제목 | 뱃지 + 링크 (`min-w-[220px]`) | `title` | `posts.title` | `is_pinned` 이면 앞에 `고정`(accent) 뱃지. 제목 클릭 → `/news/{id}`(수정 화면) |
| 카테고리 | `Badge` (폭 w-28) | — | `posts.category_key` | `newsCategoryLabel()`/`newsCategoryTone()`. 모르는 키는 키 원문 + neutral |
| 상태 · 노출 | 뱃지 2개 (폭 w-28) | — | `deriveNewsStatus()` / `deriveNewsVisibility()` | 한 칸에 나란히 표시(아래) |
| 발행일 | 텍스트(muted, `w-36`) | `published_at` (**기본 정렬, desc**) | `posts.published_at` | `formatDateTime()` = KST `YYYY-MM-DD HH:mm` |
| 조회수 | 우측 정렬 숫자(`w-24`) | `view_count` | `posts.view_count` | `toLocaleString('ko-KR')` |
| 수정일 | 텍스트(muted, `w-36`) | `updated_at` | `posts.updated_at` | `formatDateTime()`. 조회수 증가로도 밀리는 값이다(본문이 실제로 바뀐 시각은 `edited_at`) |
| 조치 | 버튼 묶음(우측, `w-56`) | — | — | `NewsRowActions`. **`news:write` 가 없으면 열 자체가 빠진다** |

정렬 헤더는 `<Link>` 다(`sortHref()`): 같은 키를 다시 누르면 `desc → asc` 로 뒤집고, 다른 키를 누르면 `desc` 로 시작한다. **정렬이 바뀌면 `page` 파라미터를 지운다.** `aria-sort` 로 현재 방향을 알리고 화살표(`↕`/`↑`/`↓`)를 붙인다.

**동작 상세**
- **상태 · 노출** — 편집 상태만으로는 "지금 독자에게 보이는가"를 알 수 없어 둘을 붙여 둔다 → [README 의 두 축 표](README.md#편집-상태-vs-클라이언트-노출-두-축).

## 1.6 행 조치 (`NewsRowActions`, `news:write` 전용)
표 전체가 일괄 처리용 `<form>` 안이라 폼을 중첩할 수 없다 — 서버 액션을 `useTransition` 안에서 직접 부른다(그러지 않으면 행 버튼이 선택된 모든 행을 함께 보낸다). 액션이 `revalidatePath()` 를 부르므로 응답 하나에 재렌더된 목록이 함께 온다.

| 필드/컨트롤 | 종류 | 노출 조건 | 확인 | 동작 / 상호작용 |
|---|---|---|---|---|
| 수정 | 링크 버튼(ghost sm) | 항상 | 없음 | `/news/{id}` |
| 보기 | 링크 버튼(ghost sm, `target="_blank" rel="noopener noreferrer"`) | 항상 | 없음 | 독자 페이지로 이동(아래) |
| 숨김 | 버튼(ghost sm) | `status === 'published'` (아래) | **없음(즉시 실행)** | `newsStateAction(intent='hide')` 실행(아래) |
| 숨김 해제 | 버튼(ghost sm) | `status === 'hidden'` (아래) | **없음(즉시 실행)** | `newsStateAction(intent='unhide')` 실행(아래) |
| 삭제 | 버튼(danger sm) | `status !== 'deleted'` | 다이얼로그 | 아래 |
| 복구 | 버튼(secondary sm) | `status === 'deleted'` | **없음(즉시 실행)** | `newsStateAction(intent='restore')` 실행(아래) |

**동작 상세**
- **보기** — `{NEXT_PUBLIC_CLIENT_SITE_URL}/news/{id}` — 관리자 미리보기가 아니라 **독자가 보는 실제 페이지**. 발행 전이면 404 지만 링크는 항상 둔다. `aria-label="{제목} 클라이언트에서 보기"`.
- **숨김 / 숨김 해제** — `newsStateAction(intent='hide'\|'unhide')` → `posts.is_hidden` → 감사 `news.hide`/`news.unhide` → 태그 `news-list` → 토스트 `"1건을 숨겼습니다."` / `"1건을 숨김을 해제했습니다."`.
- **노출 조건** — 두 버튼은 한 자리를 번갈아 쓴다(`newsHideIntent()`, `admin/lib/validation/news-state-eligibility.ts`). **임시저장·예약 글에는 둘 다 그리지 않는다** — 독자에게 이미 보이지 않아 숨길 것이 없고, 눌러도 서버가 같은 규칙으로 거절하므로 남겨 두면 빨간 토스트만 뜨는 자리가 된다. 수정·보기·삭제는 상태와 무관하게 그대로 있다.
- **복구** — `newsStateAction(intent='restore')` → `posts.deleted_at = null` → 감사 `news.restore` → 태그 `news-list` → 토스트 `"1건을 복구했습니다."`.

**행 삭제 확인 다이얼로그**
| 요소 | 문구 |
|---|---|
| 제목 | `뉴스 삭제` |
| 설명 | `"{제목}" 뉴스를 삭제합니다. 목록의 상태 필터에서 삭제를 골라 복구할 수 있습니다.` |
| 본문 | `삭제해도 데이터는 남습니다(소프트 삭제). 사용자 사이트에서는 즉시 사라집니다.` |
| 버튼 | `취소` / `삭제`(처리 중 `삭제 중…`) |

## 1.7 페이지네이션
| 필드/컨트롤 | 종류 | 동작 |
|---|---|---|
| 페이지 링크 | `<Link>` | `buildHref('/news', query, { page })`(아래) |
| 총 페이지 | — | `totalPages(list.total)` = `ceil(total / 20)`, 최소 1 |

**동작 상세**
- **페이지 링크** — `buildHref('/news', query, { page })` — 현재 필터·정렬을 그대로 물려받는다. **1페이지는 `page` 파라미터를 지운다**(`page: target === 1 ? null : String(target)`).

## 1.8 상태 변경 액션 계약 (`newsStateAction`)
`admin/lib/actions/news-actions.ts`. 행 버튼과 일괄 바가 **같은 액션**을 쓴다(대상만 `ids` 반복 필드로 다르다).

| 항목 | 값 |
|---|---|
| 권한 | `requirePermission('news', 'write')`(아래) |
| 검증 | **zod 스키마 없음.**(아래) |
| 대상 자격 | `hide` 는 `published`, `unhide` 는 `hidden` 에만. 삭제·복구는 상태를 가리지 않는다(아래) |
| 쓰기 | 세션 클라이언트 · 한 질의(아래) |
| 감사 로그 | 대상 **1건마다 1행**. before 는 갱신 전 스냅샷, after 는 `{ ...row, ...patch }` 로 계산한 스냅샷 |
| 재검증 | `revalidatePath('/news')` + 태그 `news-list`(상태 변경은 항상 태운다) |
| 성공 토스트 | `` `${처리 건수}건을 ${done}` `` + 제외가 있으면 사유 한 문장(아래) |

**동작 상세**
- **권한** — 액션 첫 줄에서 `requirePermission('news', 'write')` — 레이아웃이 막고 있어도 서버 액션은 UI 를 거치지 않는 직접 POST 로 호출될 수 있다.
- **검증** — `intent` 는 `isNewsIntent()`(`hide`·`unhide`·`delete`·`restore`), `ids` 는 `formData.getAll('ids')` 의 문자열만.
- **대상 자격** — 갱신 전 스냅샷을 읽은 뒤 각 행의 상태를 `deriveNewsStatus()` 로 판정해(목록 뱃지와 같은 판정) `isNewsIntentEligible()` 로 거른다. 규칙은 `admin/lib/validation/news-state-eligibility.ts` 한 곳에 있고 행 버튼·일괄 바가 같은 함수를 쓴다. 화면이 막더라도 서버가 다시 검사하는 이유는 서버 액션이 UI 를 거치지 않는 직접 POST 로 불릴 수 있기 때문이다.
- **일부만 대상일 때** — 대상인 id 에만 한 질의로 걸고, 감사 로그도 그만큼만 남긴다. 제외된 건수는 토스트에 사유와 함께 적는다. 전부 대상이 아니면 **질의를 보내지 않고** 감사 로그도 남기지 않는다(아무 일도 없었다는 기록이 쌓이면 로그가 흐려진다).
- **쓰기** — `update(patch).eq('board','news').in('id', 대상 id)`. 걸러진 것이 없으면 받은 `ids` 를 그대로 보낸다. 삭제 시각은 요청당 한 번만 만든다(`intentPatch(intent, now)`) — 행마다 `now()` 를 부르면 같은 일괄 처리가 감사 로그에서 한 묶음으로 읽히지 않는다.
- **성공 토스트** — done 은 `숨겼습니다.` / `숨김을 해제했습니다.` / `삭제했습니다.` / `복구했습니다.`. 제외가 있으면 뒤에 ` 발행되지 않은 N건은 제외했습니다.`(hide) / ` 숨김이 아닌 N건은 제외했습니다.`(unhide) 가 붙는다.

**오류·예외**
| 상황 | 결과 |
|---|---|
| `intent` 가 4종이 아님 | `formError` "알 수 없는 요청입니다." → 에러 토스트 |
| `ids` 가 비어 있음 | `formError` "대상을 선택해 주세요." |
| 고른 것이 전부 숨김 대상이 아님 | `formError` "발행된 글만 숨길 수 있습니다."(아래) |
| 고른 것이 전부 해제 대상이 아님 | `formError` "숨김 상태인 글만 해제할 수 있습니다."(아래) |
| 숨김 해제가 고정 한도를 넘김 | DB 트리거 `guard_news_pin_limit` 가 막음(아래) |
| 그 밖의 DB 오류 | `formError` "처리하지 못했습니다. 잠시 후 다시 시도해 주세요."(아래) |
| 권한 없음 | `requirePermission` 이 `/?error=forbidden` 으로 리다이렉트(대시보드가 배너로 사유를 알린다) |
| 이미 삭제된 행에 삭제를 다시 검 | 막지 않는다. `deleted_at` 이 새 시각으로 덮인다 |

- **고른 것이 전부 숨김 대상이 아님** — 문구는 `NEWS_HIDE_ONLY_PUBLISHED_MESSAGE`(`admin/lib/constants/news.ts`). 화면으로는 이 상태에 이르지 않는다(행 버튼이 없고 일괄 버튼은 닫혀 있다) — 직접 POST 나, 목록을 띄워 둔 사이에 다른 운영자가 상태를 바꾼 경우다.
- **고른 것이 전부 해제 대상이 아님** — 문구는 `NEWS_UNHIDE_ONLY_HIDDEN_MESSAGE`. 여기도 화면이 먼저 막는다(숨김이 0건이면 "선택 숨김 해제"가 `disabled`). 상태를 가리지 않는 조작(삭제·복구)인데 대상이 하나도 없으면 `NEWS_NO_TARGET_MESSAGE`("처리할 수 있는 대상이 없습니다.") 로 떨어진다.
- **숨김 해제가 고정 한도를 넘김** — `formError` 로 `NEWS_PIN_LIMIT_MESSAGE` 를 낸다(이 화면에는 고정 체크박스 필드가 없어 필드 오류로 붙일 곳이 없다).
- **그 밖의 DB 오류** — `console.error('[news] 상태 변경 실패', intent, …)` 로도 남는다.

**클라이언트와의 상호작용**
- 사용자 사이트 `/news`(`app/(public)/news/page.tsx`)가 `getNewsList()` → `unstable_cache(…, ['news-list'], { tags: ['news-list'], revalidate: 60 })` 로 목록을 읽는다. 이 화면의 숨김·삭제·복구는 전부 `news-list` 를 태우므로 다음 요청에서 즉시 사라지거나 되돌아온다.
- 클라이언트 목록 정렬은 `is_pinned desc, published_at desc` — 관리자의 "고정"·"발행일"과 같은 축이다. 고정 글은 `NewsCardHead` 가 `/images/news/v2/pin.png` 핀 아이콘(24px)으로 표시한다.
- 클라이언트 목록 질의는 `is_published = true and deleted_at is null` 을 명시하고, 숨김·예약은 RLS `posts_select_published` 가 거른다 — 즉 관리자 목록의 "노출" 뱃지가 `visible` 인 글만 보인다.
- **검색어가 있는 사용자 요청은 캐시를 타지 않는다**(`getNewsList` 가 `connection()` 후 직접 조회). 숨긴 글이 검색 결과에 남지 않아야 하기 때문이다. 대신 사용자 검색은 `title` 만 본다(관리자 검색은 제목+요약).
- 사용자 사이트 상세 `/news/[id]` 는 `getNewsById()` 가 세션 클라이언트로 매 요청 읽으므로, 숨김·삭제는 태그와 무관하게 즉시 404 가 된다(목록보다 먼저 반영된다).
