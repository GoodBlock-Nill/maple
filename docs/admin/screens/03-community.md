# 커뮤니티 — 화면·기능 설명

> 관리자 콘솔(`admin/`)의 커뮤니티 메뉴. 경로 · 권한 · 화면 구성 · 동작(서버 액션) · 클라이언트(사용자 사이트)와의 상호작용을 개발 참고용으로 정리한다.
> 작성 규칙: 코드에서 확인한 사실만 쓴다. 파일 경로는 저장소 루트 기준. 워딩은 "카테고리"(말머리 금지).

## 0. 한눈에
| 항목 | 값 |
|---|---|
| 경로 | `/community/posts`(대표) (하위: `/community/comments`) |
| 권한 모듈 | `community` — read / write (`admin/lib/auth/permissions.ts`). 콘텐츠 숨김·삭제 실행 함수(`moderateTarget`)는 `community` 또는 `reports` 중 하나만 write여도 통과한다(`requireAnyPermission`) — 신고 처리 화면과 공유하는 경로라서다 |
| 주요 테이블 | `posts`(board='community'), `comments` |
| 클라이언트 영향 | 태그 `community-list` 재검증 → 사용자 사이트 `/community` 목록에 즉시 반영. 상세(`/community/[id]`)는 세션 조회라 조치 즉시 404 |
| 관련 파일 | `admin/app/(admin)/community/{posts,comments}/page.tsx`, `admin/components/community/**`, `admin/lib/actions/moderation-actions.ts`, `admin/lib/data/community.ts`, `admin/lib/validation/moderation.ts` |

## 1. 커뮤니티 게시글 (`/community/posts`)
**목적** 커뮤니티 게시글을 조회하고 숨김·삭제로 노출을 관리한다.

**화면 구성**
- 필터: 카테고리, 상태(정상/숨김/삭제), 작성자(닉네임 부분검색), 시작일·종료일
- 표 열: 선택 체크박스(write만, 이미 숨김·삭제된 행은 비활성), 제목(사용자 사이트 원문 링크, 삭제된 글은 링크 없음), 작성자(회원 상세 링크), 카테고리, 상태 뱃지, 댓글수·좋아요수·조회수(정렬), 작성일(정렬), 조치
- 버튼/액션: 일괄 숨김 바(전체 선택/해제 + 선택 숨김, write만), 행별 숨김/해제(즉시 실행)·삭제/복구(확인 다이얼로그)

**동작(서버 액션)**
| 동작 | 액션 함수 | 검증 | DB 변경 | 감사 로그 | 클라이언트 영향 |
|---|---|---|---|---|---|
| 숨김/해제 | `setPostHiddenAction` (`admin/lib/actions/moderation-actions.ts`) | zod `toggleContentSchema` (`admin/lib/validation/moderation.ts`) | `posts.is_hidden` | `community.post.hide` / `community.post.unhide`(※ 아래 주의) | `revalidatePath('/community/posts','/reports')` + 태그 `community-list` |
| 삭제/복구 | `setPostDeletedAction` | zod `toggleContentSchema` | `posts.deleted_at` | `community.post.delete` / `community.post.restore` | 동일 |
| 일괄 숨김(최대 100건) | `bulkHidePostsAction` | zod `bulkHideSchema` | `posts.is_hidden=true`(다건) | `community.post.bulk_hide`(※ 아래 주의) | 동일 |

**클라이언트와의 상호작용**
- 사용자 사이트 `/community`(`app/(public)/community/page.tsx` → `lib/data/community.ts`의 `getCommunityList`)가 `community-list` 태그로 `unstable_cache`(60초)된 목록을 읽는다. 관리자 쓰기 후 `revalidateClient(['community-list'])`가 사용자 사이트 `POST /api/revalidate`를 호출해 즉시 비운다.
- 상세(`getPostById`)는 세션 클라이언트로 매 요청 읽으므로 숨김·삭제는 다음 요청부터 바로 반영된다(목록보다 먼저).
- 이 화면에서 처리한 숨김·삭제는 `/reports`(신고 큐)의 대상 상태 표시에도 즉시 반영된다(같은 액션이 `/reports`도 `revalidatePath`한다).

**주의**
- 삭제가 숨김보다 우선한다 — `deleted_at`과 `is_hidden`이 동시에 서 있어도 화면은 "삭제"로 표시한다(`contentStatus()`).
- 숨김/해제는 확인 없이 즉시 실행, 삭제/복구만 확인 다이얼로그를 거친다.
- `community.post.hide`처럼 도메인이 `community`인 감사 로그 액션은 `admin/components/audit/audit-labels.ts`의 `DOMAIN_LABELS`에 `community` 키가 없어, 목록에서 라벨 대신 원문 액션 문자열이 노출될 수 있다. `bulk_hide`도 `VERB_LABELS`에 없어 같은 문제가 겹친다.

## 2. 커뮤니티 댓글 (`/community/comments`)
**목적** 커뮤니티 댓글을 조회하고 숨김·삭제로 노출을 관리한다.

**화면 구성**
- 필터: 상태, 작성자, 시작일·종료일(카테고리 필터는 없음 — 댓글에는 카테고리가 없음)
- 표 열: 선택 체크박스(write만), 내용(2줄 발췌), 게시글(원 게시글 제목, 사용자 사이트 원문 링크 — 관리자에는 게시글 상세 화면이 없어 항상 원문으로 보낸다), 작성자, 상태 뱃지, 작성일(정렬), 조치
- 버튼/액션: 1절과 동일한 패턴(일괄 숨김 바, 행별 숨김/해제·삭제/복구)

**동작(서버 액션)**
| 동작 | 액션 함수 | 검증 | DB 변경 | 감사 로그 | 클라이언트 영향 |
|---|---|---|---|---|---|
| 숨김/해제 | `setCommentHiddenAction` (`admin/lib/actions/moderation-actions.ts`) | zod `toggleContentSchema` | `comments.is_hidden` | `community.comment.hide` / `community.comment.unhide` | `revalidatePath('/community/comments','/reports')` + 태그 `community-list` |
| 삭제/복구 | `setCommentDeletedAction` | zod `toggleContentSchema` | `comments.deleted_at` | `community.comment.delete` / `community.comment.restore` | 동일 |
| 일괄 숨김(최대 100건) | `bulkHideCommentsAction` | zod `bulkHideSchema` | `comments.is_hidden=true`(다건) | `community.comment.bulk_hide` | 동일 |

**클라이언트와의 상호작용**
- 댓글에는 자체 상세 주소가 없다 — 사용자 사이트에서는 원 게시글(`/community/[postId]`) 안에 렌더된다. 숨긴 댓글은 게시글 상세에서도 사라진다(작성자 본인에게도 보이지 않음).
- 게시글과 마찬가지로 `community-list` 태그를 태우지만, 댓글 자체는 목록 캐시 대상이 아니다 — 게시글 목록의 `comment_count`가 트리거로 유지되므로, 댓글 숨김·삭제가 그 카운트에 영향을 준다면 게시글 목록도 함께 최신화해야 해서 같은 태그를 쓴다.

**주의**
- 1절과 동일하게 삭제 우선순위, 즉시실행/확인 다이얼로그 구분, 감사 로그 라벨 미매핑 이슈(`community` 도메인, `unhide`/`bulk_hide` verb)가 동일하게 적용된다.
