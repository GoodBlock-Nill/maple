# 커뮤니티 — 메뉴 개요

> 관리자 콘솔(`admin/`)의 커뮤니티 메뉴. 사용자가 쓴 게시글·댓글을 조회하고 숨김·삭제로 노출을 관리한다. 관리자가 글을 **작성하는** 화면은 없다(작성은 사용자 사이트 `/community/write` 전용).
> 작성 규칙: 코드에서 확인한 사실만 쓴다. 파일 경로는 저장소 루트 기준. 워딩은 "카테고리".

## 0. 한눈에
| 항목 | 값 |
|---|---|
| 경로 | `/community/posts`(대표), `/community/comments` |
| 권한 모듈 | `community` — read / write (`admin/lib/auth/permissions.ts`). **read**: 목록·필터·정렬·페이지(선택 열, 일괄 숨김 바, 행 조치 열이 통째로 빠진다). **write**: 선택 체크박스 + 일괄 숨김 바 + 행별 숨김/해제·삭제/복구. 예외로 `moderateTarget()`(신고 처리가 부르는 공용 숨김·삭제 경로)만 `requireAnyPermission(['community','reports'], 'write')` — 신고 담당 역할이 커뮤니티 쓰기 없이도 대상을 숨길 수 있어야 하기 때문 |
| 주요 테이블 | `posts`(board='community' — `title`·`category_key`·`author_id`·`author_name`·`is_hidden`·`deleted_at`·`comment_count`·`like_count`·`view_count`·`created_at`), `comments`(`post_id`·`content`·`author_id`·`author_name`·`is_hidden`·`deleted_at`·`created_at`), `board_categories`(board='community') |
| 클라이언트 영향 | 태그 `community-list` 재검증 → 사용자 사이트 `/community` 목록(`lib/data/community.ts` 의 `getCommunityList`, `unstable_cache` 60초)에 즉시 반영. 상세 `/community/[id]` 와 댓글은 세션 조회라 태그와 무관하게 다음 요청부터 바로 사라진다. 관리자 화면 `/community/posts`·`/community/comments` + **`/reports`** 도 함께 `revalidatePath` |
| 관련 파일 | 페이지 `admin/app/(admin)/community/{posts,comments}/page.tsx` · 컴포넌트 `admin/components/community/{ContentFilters,BulkHideBar,ModerationActions}.tsx` · 액션 `admin/lib/actions/moderation-actions.ts` · 데이터 `admin/lib/data/community.ts` · 검증 `admin/lib/validation/moderation.ts` · 캐시 `admin/lib/revalidate.ts` · 마이그레이션 `20260908000300_boards_posts_comments`, `20260908000700_rls_policies`, `20260908001100_reports_and_author_edits`, `20260908001700_admin_foundation` |

## 화면 목록
| 파일 | 경로 | 설명 |
|---|---|---|
| [01-posts.md](01-posts.md) | `/community/posts` | 게시글 목록 · 필터 5종 · 정렬 4종 · 일괄 숨김 · 행 조치 |
| [02-comments.md](02-comments.md) | `/community/comments` | 댓글 목록 · 필터 4종 · 작성일 정렬 · 일괄 숨김 · 행 조치 |
| [03-moderation-dialog.md](03-moderation-dialog.md) | (두 화면 공용) | 일괄 숨김 바 · 삭제/복구 확인 다이얼로그 · 조치 액션 계약 |

## 메뉴 전체 규칙

### 두 축: 숨김(`is_hidden`) vs 삭제(`deleted_at`)
| 컬럼 | 누가 세우나 | 의미 |
|---|---|---|
| `is_hidden` | **운영자만**(가드 트리거 `guard_post_counters` / `guard_comment_columns` 가 일반 사용자의 변경을 이전 값으로 되돌린다) | 운영 숨김. 작성자에게도 보이지 않는다(`posts_select_own` 에 `not is_hidden` 이 붙어 있다) |
| `deleted_at` | 작성자(본인 삭제) **또는** 운영자 | 소프트 삭제. 행은 남는다 |

**표시 상태**(`contentStatus()`, `admin/lib/validation/moderation.ts`) — **삭제가 숨김을 이긴다.**

| 값 | 라벨 | 톤 | 판정 |
|---|---|---|---|
| `deleted` | 삭제 | danger | `deletedAt !== null` (숨김 여부와 무관) |
| `hidden` | 숨김 | warn | `deletedAt === null && isHidden` |
| `visible` | 정상 | success | 둘 다 아님 |

두 값이 동시에 서 있을 때 "숨김"으로 보이면 운영자가 복구 버튼을 눌러도 글이 돌아오지 않는 것처럼 느낀다.

### 카테고리 (게시글만)
`COMMUNITY_CATEGORY_KEYS = ['chat', 'question', 'info']` — 필터 값 **검증용** 상수다. 화면에 그리는 라벨은 코드에 박지 않고 `getCommunityCategoryLabels()` 가 `board_categories`(board='community', `sort_order` asc)에서 읽는다. 사용자 사이트와 같은 단일 출처라 운영자가 라벨을 바꾸면 양쪽이 함께 바뀐다. 사용자 사이트 기본 라벨은 잡담 · 질문 · 정보(`lib/constants/board.ts`). 댓글에는 카테고리가 없다.

### 조치 실행 규칙
- 모든 액션이 첫 줄에서 권한을 다시 확인한다(레이아웃이 막고 있어도 서버 액션은 UI 를 거치지 않는 직접 POST 로 호출된다).
- 쓰기는 **세션 클라이언트**로만 한다. RLS `posts_update_admin` · `comments_admin_all` 이 다시 검사하므로 권한이 사라지면 조치도 함께 막힌다. `guard_post_counters()` 는 `is_admin()` 일 때 통과하므로 관리자 수정이 되돌려지지 않는다.
- **숨김/해제는 확인 없이 즉시 실행**하고, 삭제/복구만 확인 다이얼로그를 거친다. 모든 조작을 다이얼로그로 감싸면 운영자가 습관적으로 확인을 눌러 결국 아무것도 막지 못한다.
- 원문 미리보기·작성자 이동은 조치 버튼으로 두지 않는다 — 표의 제목·작성자 칸이 이미 같은 곳으로 가는 링크다.

### 감사 로그
`community.{post|comment}.{hide|unhide|delete|restore|bulk_hide}` — before `{ is_hidden, deleted_at }`, after 는 적용한 패치. 일괄 숨김만 `targetId` 없이 after `{ ids, count }` 를 남긴다.

**라벨 매핑 공백**(`admin/components/audit/audit-labels.ts`): `DOMAIN_LABELS` 에 **`community` 키가 없고**, `VERB_LABELS` 에 **`unhide`·`bulk_hide` 가 없다**. `auditActionLabel()` 은 도메인이나 동사 중 하나라도 모르면 원문을 그대로 돌려주므로, 커뮤니티 조치는 감사 로그 목록에서 전부 `community.post.hide` 같은 **영문 문자열로 보인다**. (`TABLE_LABELS` 의 `posts`·`comments` 는 매핑되어 있어 "대상" 칸만 한국어로 나온다.)

### 캐시 재검증
`revalidateFor(table)` 이 세 곳을 비운다.
1. `revalidatePath('/community/posts')` 또는 `'/community/comments'` — 방금 조치한 관리자 목록
2. `revalidatePath('/reports')` — 신고 큐가 대상의 숨김·삭제 뱃지를 함께 보여 준다
3. `revalidateClient(['community-list'])` — 사용자 사이트 `POST /api/revalidate` → `revalidateTag('community-list', { expire: 0 })`

사용자 사이트 상세는 `unstable_cache` 를 쓰지 않으므로(세션 클라이언트) 태그와 무관하게 즉시 반영된다. 목록만 태우지 않으면 최대 1분간 지운 글이 남는다.
