# 커뮤니티 댓글 (`/community/comments`)

**목적** 커뮤니티 댓글을 상태·작성자·기간으로 추려 보고, 숨김·삭제로 노출을 관리한다. 댓글에는 자체 상세 화면이 없어(관리자·사용자 양쪽) 맥락은 원 게시글 링크로 확인한다.

**데이터 출처**
- 진입 가드 `requirePermission('community', 'read')`, 쓰기 노출은 `hasPermission(…, 'community', 'write')`.
- `parseCommentListParams(searchParams)` → `getCommunityComments(params)` (`admin/lib/data/community.ts`). `comments` 전체를 읽는다 — **`board` 로 좁히지 않는다**(사용자 사이트 뉴스 상세 `app/(public)/news/[id]/page.tsx` 에는 댓글 섹션이 없어, 실제로 쌓이는 댓글은 커뮤니티 글의 것뿐이다). 숨김·삭제 행이 보이는 근거는 RLS `comments_select_admin`.
- select 에 `posts(title)` 임베드가 들어간다(원 게시글 제목 1열).
- 페이지 크기 20, 정렬은 **`created_at` 하나뿐**(`COMMENT_SORT_KEYS = ['created_at']`), 기본 `desc`.
- `export const dynamic = 'force-dynamic'`.
- 조회 실패: `{ rows: [], count: 0, hasError: true }` → 표 위 `FormBanner`(`LIST_LOAD_ERROR`).

## 1.1 헤더
| 필드 | 값 |
|---|---|
| 제목 | "커뮤니티 댓글" |
| 설명 | `총 {count}건. 숨긴 댓글은 작성자에게도 보이지 않습니다.` |

## 1.2 필터 폼 (`ContentFilters`, `categories` 없이 호출)
게시글 화면과 같은 컴포넌트이고, **카테고리 select 만 빠진다**(댓글에는 카테고리가 없다).

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값·프리필 | 동작 / 상호작용 |
|---|---|---|---|---|
| 정렬 보존 | hidden `sort` | — | 현재 `?sort=` | — |
| 상태 | `Select` `name="status"` (w-32) | `visible`·`hidden`·`deleted`. 밖의 값은 전체 | placeholder "전체" | `applyStatusFilter()` — 게시글과 같은 두 컬럼(`is_hidden`·`deleted_at`)을 쓴다 |
| 작성자 | `Input` `name="author"` (w-44) | `maxLength 60` | placeholder "닉네임 일부" | `ilike('author_name', '%…%')` — `comments.author_name`(작성 시점 스냅샷) |
| 시작일 | `Input type="date"` `name="from"` | `YYYY-MM-DD` | — | `created_at >= {KST 00:00}` |
| 종료일 | `Input type="date"` `name="to"` | 〃 | — | `created_at < {다음 날 KST 00:00}`(종료일 당일 포함) |
| 검색 / 초기화 | 버튼 | 초기화는 항상 보인다 | — | 초기화 → `/community/comments` |

## 1.3 일괄 숨김 바 (`BulkHideBar`, `community:write` 전용)
| 필드/컨트롤 | 동작 |
|---|---|
| 안내 문구 | 선택 0건이면 `댓글을 선택해 일괄 숨김할 수 있습니다.`, 그 외 `{n}건 선택됨` |
| 전체 선택/해제 · 선택 숨김 | `bulkHideCommentsAction`. 상세는 [03-moderation-dialog.md](03-moderation-dialog.md) |

## 1.4 표
`caption="커뮤니티 댓글 목록"`, 빈 결과 `"조건에 맞는 댓글이 없습니다."`.

| 열 | 종류 | 정렬 | 값의 출처 | 동작 / 표시 규칙 |
|---|---|---|---|---|
| 선택 | 체크박스 `name="ids" form="bulk-hide-form"` (w-10) | — | `row.id` | `aria-label`·비활성 조건(아래) |
| 내용 | 텍스트(`line-clamp-2 whitespace-pre-wrap`, `title` 툴팁에 전문) | — | `comments.content` | 폭 지정이 없어 남은 자리를 전부 먹는다. **평문이다**(댓글에는 에디터가 없다) |
| 게시글 | 외부 링크(w-44, `line-clamp-1`) | — | `posts(title)` 임베드 | 원문 링크 규칙(아래) |
| 작성자 | 링크 또는 텍스트(w-28) | — | `author_name` / `author_id` | `author_id !== null` 이면 `/members/{authorId}`. 탈퇴 계정은 muted 텍스트 |
| 상태 | `Badge`(w-20) | — | `contentStatus(row)` | 정상(success) / 숨김(warn) / 삭제(danger) |
| 작성일 | 텍스트(muted, w-36) | `created_at` (**유일한 정렬 키, 기본 desc**) | `comments.created_at` | `formatDateTime()` |
| 조치 | 버튼 묶음(우측, w-124px) | — | — | `ModerationActions kind="comment"`(아래) |

**동작 상세**
- **선택** — `aria-label="{내용 앞 20자} 선택"`. 이미 숨김·삭제된 행은 `disabled`. read 전용이면 열 자체가 빠진다.
- **게시글** — `{CLIENT_SITE_URL}/community/{post_id}` 새 탭. 관리자에는 게시글 상세 화면이 없어 **항상 사용자 사이트 원문으로 보낸다**. 원 게시글이 조회되지 않으면 제목 자리에 `(삭제된 게시글)`. 게시글이 삭제됐어도 **링크는 그대로 걸린다**(게시글 목록과 달리 링크를 떼지 않는다 — 누르면 404).
- **조치** — 원문 미리보기 버튼은 없다 — "게시글" 칸의 링크가 그 역할을 한다.

## 1.5 행 조치 (`ModerationActions kind="comment"`)
| 필드/컨트롤 | 노출·활성 조건 | 확인 | 동작 |
|---|---|---|---|
| 숨김 / 숨김 해제 | 삭제된 행에서는 `disabled` | 없음(즉시) | `setCommentHiddenAction` 실행(아래) |
| 삭제 / 복구 | 항상 | 다이얼로그(제목 `댓글 삭제`/`댓글 복구`) | `setCommentDeletedAction` 실행(아래) |

**동작 상세**
- **숨김 / 숨김 해제** — `setCommentHiddenAction` → `comments.is_hidden` → 감사 `community.comment.hide`/`unhide` → 토스트 `"댓글을 숨김 처리했습니다."` / `"댓글을 숨김 해제했습니다."`.
- **삭제 / 복구** — `setCommentDeletedAction` → `comments.deleted_at` → 감사 `community.comment.delete`/`restore` → 토스트 `"댓글을 삭제했습니다."` / `"댓글을 복구했습니다."`.

## 1.6 페이지네이션
`buildHref('/community/comments', searchParams, { page: String(page) })`, 총 페이지 `ceil(count / 20)`.

**상태·뱃지 의미** → [README 의 두 축 표](README.md#두-축-숨김is_hidden-vs-삭제deleted_at).

**클라이언트와의 상호작용**
- 댓글에는 **자체 주소가 없다.** 사용자 사이트에서는 원 게시글 상세(`/community/[postId]`) 안 `CommentSection` 으로만 렌더된다.
- 숨긴 댓글은 게시글 상세에서 사라진다 — 목록 질의(`getComments`)가 `deleted_at is null` 을 걸고, 숨김은 RLS `comments_select_public`(`deleted_at is null and not is_hidden and 부모 글이 공개`)이 막는다. **작성자 본인에게도 보이지 않는다**(댓글에는 `comments_select_own` 같은 예외 정책이 없다).
- 상세는 세션 클라이언트로 매 요청 읽으므로 조치가 **다음 요청부터 즉시** 반영된다. 삭제된 댓글은 자리를 남기지 않는다(대댓글이 없어 순서가 삭제에 의존하지 않는다).
- 조치는 `community-list` 태그도 태운다. 댓글 자체는 목록 캐시 대상이 아니지만, 게시글 목록의 `comment_count` 가 트리거로 유지되므로 함께 최신화한다.
- `/reports` 도 함께 `revalidatePath` 되어 신고 큐의 대상 뱃지가 갱신된다.
- 반대 방향: 사용자가 자기 댓글을 지우면 `deleted_at` 이 채워져 이 목록에 `삭제` 로 나타난다. 정지 중인 사용자는 애초에 댓글을 쓸 수 없다(`comments_insert_own` 에 `not public.is_suspended()`).

**오류·예외**
| 상황 | 결과 |
|---|---|
| 조회 실패 | 배너 + 빈 표 |
| 원 게시글이 조회되지 않음 | "게시글" 칸에 `(삭제된 게시글)`. 링크는 그대로 있고 누르면 404 |
| 대상이 그 사이 사라짐 | `formError` "댓글을 찾을 수 없습니다." |
| 조치 실패 | `formError` "댓글 처리를 하지 못했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요." |
| `?sort=` 에 `created_at` 외의 값 | 기본값으로 떨어진다(다른 정렬 키가 없다) |
| 읽기 전용 관리자 | 선택 열·일괄 바 없음, 조치 셀 비어 있음 |
