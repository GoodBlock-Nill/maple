# 커뮤니티 게시글 (`/community/posts`)

**목적** 사용자가 쓴 커뮤니티 글을 카테고리·상태·작성자·기간으로 추려 보고, 숨김·삭제로 사용자 사이트 노출을 관리한다. 신고로 들어온 글을 확인할 때도 이 화면으로 온다.

**데이터 출처**
- 진입 가드 `requirePermission('community', 'read')`, 쓰기 버튼 노출은 `hasPermission(permissions, 'community', 'write')`.
- `parsePostListParams(searchParams)` → `getCommunityPosts(params)` (`admin/lib/data/community.ts`). 세션 클라이언트로 `posts` 를 `board='community'` 로 좁혀 읽는다 — 숨김·삭제 행까지 보이는 근거는 RLS `posts_select_admin` 하나뿐이다.
- `getCommunityCategoryLabels()` — 카테고리 필터 옵션 + 표의 라벨.
- 페이지 크기 20(`DEFAULT_PAGE_SIZE`), 기본 정렬 `created_at desc`, 2차 정렬은 항상 `created_at desc`.
- `export const dynamic = 'force-dynamic'` — 정적 렌더를 재사용하면 숨김을 누른 뒤에도 이전 상태가 남는다.
- 조회 실패: `{ rows: [], count: 0, hasError: true }` → 표 위에 `FormBanner`(`LIST_LOAD_ERROR` — "목록을 불러오지 못했습니다. 표가 비어 보이는 것은 데이터가 없어서가 아닙니다. 새로고침해 주세요."). 카테고리 라벨 조회만 실패하면 빈 객체가 되어 표에 **키 원문**(`chat` 등)이 찍힌다.

## 1.1 헤더
| 필드 | 값 |
|---|---|
| 제목 | "커뮤니티 게시글" |
| 설명 | `총 {count}건. 숨김·삭제는 사용자 사이트에 즉시 반영됩니다.` — count 는 `toLocaleString('ko-KR')`, **필터가 적용된 건수**다 |

## 1.2 필터 폼 (`ContentFilters`)
상태를 갖지 않는 GET 폼(`method="get" action="/community/posts"`). `sort` 만 hidden 으로 실어 보내고(없으면 검색할 때마다 정렬이 풀린다), `page` 는 일부러 뺀다. 자동 제출은 없다 — 값을 고른 뒤 "검색"을 눌러야 반영된다.

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값·프리필 | 동작 / 상호작용 |
|---|---|---|---|---|
| 정렬 보존 | hidden `sort` | — | 현재 `?sort=`(없으면 필드 자체를 그리지 않는다) | — |
| 카테고리 | `Select` `name="category"` (w-36) | `COMMUNITY_CATEGORY_KEYS`(`chat`·`question`·`info`) 밖의 값은 무시(전체) | placeholder "전체", 현재 `?category=` | `query.eq('category_key', …)`. **게시글 목록에만 있다** |
| 상태 | `Select` `name="status"` (w-32) | `CONTENT_STATUS_FILTERS`(`visible`·`hidden`·`deleted`), 라벨 정상/숨김/삭제. 밖의 값은 전체 | placeholder "전체" | `visible` → `is_hidden=false and deleted_at is null` / `hidden` → `is_hidden=true and deleted_at is null` / `deleted` → `deleted_at is not null` / 없음 → **조건 없음(삭제된 글도 함께 나온다)** |
| 작성자 | `Input` `name="author"` (w-44) | `maxLength = SEARCH_MAX_LENGTH(60)`, 라벨 옆 카운트 | placeholder "닉네임 일부" | `containsPattern()` 으로 `\ % _` 를 이스케이프한 뒤 `ilike('author_name', '%…%')` — **작성 시점 닉네임 스냅샷**(`posts.author_name`)을 찾는다. 회원이 닉네임을 바꿔도 옛 글은 옛 닉네임으로 남는다 |
| 시작일 | `Input type="date"` `name="from"` (w-40) | `YYYY-MM-DD`. 파싱 실패면 조건 없음 | 현재 `?from=` | `kstDayBoundary(from)` → `created_at >= {그날 KST 00:00}` |
| 종료일 | `Input type="date"` `name="to"` (w-40) | 위와 동일 | 현재 `?to=` | `kstDayBoundary(to, 1)` → `created_at < {다음 날 KST 00:00}` — **종료일 당일을 포함**한다 |
| 검색 | submit 버튼 | — | — | 폼 제출 |
| 초기화 | 링크 버튼(ghost) | **항상 보인다**(필터 유무와 무관) | — | `/community/posts` — 정렬·페이지까지 전부 지운다 |

기간 경계를 KST 로 끊는 이유: UTC 자정으로 끊으면 오전 9시 이전 글이 전날로 밀려 운영자가 고른 기간과 화면의 "작성일"이 어긋난다.

## 1.3 일괄 숨김 바 (`BulkHideBar`, `community:write` 전용)
표 위에 붙는 줄. 상세는 [03-moderation-dialog.md](03-moderation-dialog.md) 참고.

| 필드/컨트롤 | 종류 | 동작 |
|---|---|---|
| 안내 문구 | 텍스트 | 선택 0건이면 `게시글을 선택해 일괄 숨김할 수 있습니다.`, 그 외 `{n}건 선택됨` |
| 전체 선택/해제 | 버튼(ghost sm) | 이 페이지의 **비활성이 아닌** 체크박스만 토글 |
| 선택 숨김 | submit 버튼(secondary sm) | `bulkHidePostsAction`. 선택 0건·처리 중이면 `disabled`, 처리 중 라벨 `숨기는 중…` |

## 1.4 표
`caption="커뮤니티 게시글 목록"`, 빈 결과 문구 `"조건에 맞는 게시글이 없습니다."`, 최소 폭 720px(가로 스크롤).

| 열 | 종류 | 정렬 | 값의 출처 | 동작 / 표시 규칙 |
|---|---|---|---|---|
| 선택 | 체크박스 `name="ids" form="bulk-hide-form"` (w-10, 가운데) | — | `row.id` | `aria-label="{제목} 선택"`. **이미 숨김이거나 삭제된 행은 `disabled`**(+`opacity-40`). `community:write` 가 없으면 열 자체가 빠진다 |
| 제목 | 링크 또는 텍스트 (`min-w-[160px]`, `line-clamp-1`, `title` 툴팁) | — | `posts.title` | `deletedAt === null` 이면 `{CLIENT_SITE_URL}/community/{id}` 새 탭(`target="_blank" rel="noreferrer"`). **삭제된 글은 링크 없이 muted 텍스트**(상세가 404 라서) |
| 작성자 | 링크 또는 텍스트 (w-28) | — | `author_name` / `author_id` | `author_id !== null` 이면 `/members/{authorId}`(관리자 회원 상세, 같은 탭). 탈퇴로 `author_id = null` 이면 muted 텍스트만 |
| 카테고리 | `Badge` (w-24) | — | `category_key` | `categories[key] ?? key` — 라벨을 못 읽으면 키 원문. 기본 톤(색 구분 없음) |
| 상태 | `Badge` (w-20) | — | `contentStatus(row)` | 정상(success) / 숨김(warn) / 삭제(danger) |
| 댓글 | 우측 정렬 숫자 (w-20) | `comment_count` | `posts.comment_count` | 트리거가 유지하는 집계값. 천 단위 구분 없음(원시 숫자) |
| 좋아요 | 우측 정렬 숫자 (w-20) | `like_count` | `posts.like_count` | 〃 |
| 조회 | 우측 정렬 숫자 (w-20) | `view_count` | `posts.view_count` | 〃 |
| 작성일 | 텍스트(muted, w-36) | `created_at` (**기본, desc**) | `posts.created_at` | `formatDateTime()` = KST `YYYY-MM-DD HH:mm` |
| 조치 | 버튼 묶음(우측, w-124px) | — | — | `ModerationActions kind="post"`. `community:write` 가 없으면 셀이 비어 있다(열은 남는다) |

정렬 링크는 `sortHref('/community/posts', searchParams, params.sort, key)` — 같은 키를 다시 누르면 `desc → asc`, 다른 키는 `desc` 로 시작하고 **`page` 파라미터를 지운다**. 허용 키(`POST_SORT_KEYS`) 밖의 `?sort=` 는 기본값으로 떨어진다.

## 1.5 행 조치 (`ModerationActions`, `community:write` 전용)
| 필드/컨트롤 | 종류 | 노출·활성 조건 | 확인 | 동작 |
|---|---|---|---|---|
| 숨김 / 숨김 해제 | 폼 제출 버튼(secondary sm). 숨은 필드 `id`, `on`(현재 숨김이면 `0`, 아니면 `1`) | **삭제된 행에서는 `disabled`** | 없음(즉시) | `setPostHiddenAction` → `posts.is_hidden` → 감사 `community.post.hide`/`unhide` → 토스트 `"게시글을 숨김 처리했습니다."` / `"게시글을 숨김 해제했습니다."` |
| 삭제 / 복구 | 버튼(삭제=danger, 복구=secondary) | 항상 | 다이얼로그 | `setPostDeletedAction` → `posts.deleted_at` → 감사 `community.post.delete`/`restore` → 토스트 `"게시글을 삭제했습니다."` / `"게시글을 복구했습니다."` |

다이얼로그 문구와 액션 계약은 [03-moderation-dialog.md](03-moderation-dialog.md).

## 1.6 페이지네이션
`buildHref('/community/posts', searchParams, { page: String(page) })` — 현재 필터·정렬을 그대로 물려받는다. **1페이지에도 `?page=1` 을 붙인다**(뉴스 목록과 다른 점). 총 페이지 `ceil(count / 20)`, 최소 1.

**상태·뱃지 의미** → [README 의 두 축 표](README.md#두-축-숨김is_hidden-vs-삭제deleted_at).

**클라이언트와의 상호작용**
- 사용자 사이트 `/community`(`app/(public)/community/page.tsx` → `getCommunityList`)는 **익명 클라이언트**로 읽어 `community-list` 태그로 캐시한다(60초). 세션 클라이언트로 읽으면 관리자에게는 `posts_select_admin` 때문에 숨긴 글이 목록에 남아 "누가 보든 같은 목록"이 깨진다.
- 여기서 숨기거나 지우면 `revalidateClient(['community-list'])` 가 태그를 태워 **다음 요청에서 목록에서 사라진다**. 검색어가 있는 요청(`?q=`)은 애초에 캐시를 타지 않아 항상 최신이다.
- 상세 `/community/[id]`(`getPostById`)는 `deleted_at is null` 을 명시하고 숨김은 RLS 가 막으므로 **조치 즉시 404**(`notFound()`)가 된다. 작성자 본인에게도 마찬가지다 — `posts_select_own` 정책에 `not is_hidden` 이 들어 있다(이의 제기는 고객지원 문의로 받는다).
- 숨긴 글에 달린 댓글도 함께 사라진다 — `comments_select_public` 이 부모 글의 `is_published and deleted_at is null and not is_hidden` 을 함께 본다.
- 이 조치는 `/reports` 도 함께 `revalidatePath` 해서, 신고 큐의 대상 행에 `숨김`/`삭제` 뱃지가 즉시 붙는다.
- 사용자 사이트 목록 행(`PostRow`)은 제목·댓글수·작성자(마스킹, `authorLabel()`)·카테고리 뱃지·작성일·조회수·좋아요를 그린다. 관리자 목록의 카테고리·댓글·좋아요·조회 열과 같은 값이다.
- 반대 방향: 사용자가 글을 지우면(`deleted_at` 을 스스로 채움) 이 목록에서 상태 `삭제` 로 보인다. 관리자 조치와 **작성자 삭제를 구분하는 표시는 없다** — 구분은 감사 로그(`community.post.delete` 행의 유무)로만 가능하다.

**오류·예외**
| 상황 | 결과 |
|---|---|
| 조회 실패 | 배너 + 빈 표(위 참고) |
| 잘못된 `?status=`·`?category=`·`?sort=` | 조용히 기본값(전체 / 기본 정렬)으로 떨어진다 |
| 잘못된 `?from=`·`?to=` | 해당 조건만 무시된다 |
| 대상이 그 사이 사라짐 | 조치 시 `formError` "게시글을 찾을 수 없습니다." |
| 조치 실패(DB 오류) | `formError` "게시글 처리를 하지 못했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요." — 에러 토스트로 뜬다 |
| 읽기 전용 관리자 | 선택 열·일괄 바는 렌더되지 않고, 조치 셀은 비어 있다. 직접 POST 해도 `requirePermission('community','write')` 이 막는다 |
