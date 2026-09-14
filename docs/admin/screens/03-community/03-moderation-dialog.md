# 일괄 숨김 바 · 삭제/복구 다이얼로그 (게시글·댓글 공용)

**목적** 게시글 목록과 댓글 목록이 **같은 컴포넌트**로 쓰는 조치 UI 와, 그 뒤의 서버 액션 계약을 한곳에 모은다. 라우트가 따로 없는 화면 요소다(`/community/posts`·`/community/comments` 위에 렌더된다).

**관련 파일** `admin/components/community/{BulkHideBar,ModerationActions}.tsx` · `admin/lib/actions/moderation-actions.ts` · `admin/lib/validation/moderation.ts`

## 1.1 일괄 숨김 바 (`BulkHideBar`)
표 **밖**에 있는 빈 `<form id="bulk-hide-form">` 과 표 **안**의 체크박스를 HTML `form` 속성으로 잇는다. 표를 `<form>` 으로 감싸면 행마다 있는 조치 폼과 중첩 폼이 되어 HTML 이 깨진다.

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값 | 동작 / 상호작용 |
|---|---|---|---|---|
| 선택 개수 안내 | 텍스트(muted) | — | `{라벨}을 선택해 일괄 숨김할 수 있습니다.` | 0건·1건 이상 표시 규칙(아래) |
| 전체 선택/해제 | 버튼(ghost sm) | — | — | 켜거나 끄는 범위·조건(아래) |
| 선택 숨김 | submit 버튼(secondary sm) | 선택 0건이거나 처리 중이면 `disabled` | — | `bulkHidePostsAction` / `bulkHideCommentsAction`. 처리 중 라벨 `숨기는 중…` |
| (숨은) 대상 | 체크박스 `name="ids"` ×N | `bulkHideSchema.ids = z.array(z.uuid()).min(1).max(BULK_HIDE_MAX=100)` | — | 표의 `BulkSelectCheckbox` 가 `form` 속성으로 이 폼에 실어 보낸다 |

**동작 상세**
- **선택 개수 안내** — 0건이면 안내 문구, 1건 이상이면 `{n}건 선택됨`. 조사는 `josa()` 가 붙인다(게시글**을** / 댓글**을**).
- **전체 선택/해제** — `document.querySelectorAll('input[form="bulk-hide-form"]:not(:disabled)')` 를 모두 켜거나 끈다. **현재 페이지 20건 범위**이고, 이미 숨김·삭제된 행(=`disabled`)은 건드리지 않는다.

- 선택 개수는 **문서 레벨 `change` 이벤트**로 센다 — 체크박스가 폼의 자식이 아니라 폼에 `onChange` 를 걸어도 이벤트가 올라오지 않는다.
- 성공하면 토스트(success) + 선택 개수 표시를 0 으로 되돌린다. 실패하면 토스트(error)만 띄운다.
- **확인 다이얼로그가 없다.** 숨김은 되돌리기 쉬운 조작이라 즉시 실행한다.

## 1.2 삭제 / 복구 확인 다이얼로그 (`ModerationActions`)
| 요소 | 삭제할 때 | 복구할 때 |
|---|---|---|
| 제목 | `게시글 삭제` / `댓글 삭제` | `게시글 복구` / `댓글 복구` |
| 설명 | `사용자 사이트에서 보이지 않게 합니다. 행은 남으므로 복구할 수 있습니다.` | `삭제 표시를 지워 사용자 사이트에 다시 노출합니다.` |
| 폼 | 숨은 `id` + 숨은 `on="1"` | 숨은 `id` + 숨은 `on="0"` |
| 버튼 | `취소` / `삭제`(danger, 처리 중 `삭제 중…`) | `취소` / `복구`(primary, 처리 중 `복구 중…`) |
| 확정 시 | `setPostDeletedAction` / `setCommentDeletedAction` | 같은 액션에 `on=0` |

성공 처리는 이펙트가 아니라 액션 래퍼(`withToast`) 안에서 한다 — 이펙트로 두면 같은 결과를 두 번 처리하는 경로가 생긴다. 성공 시 토스트 + 다이얼로그 닫힘, 실패 시 에러 토스트(다이얼로그는 열린 채).

## 1.3 서버 액션 계약
모든 액션이 `admin/lib/actions/moderation-actions.ts` 에 있고, 첫 줄에서 `requirePermission('community', 'write')` 를 부른다(`moderateTarget()` 만 예외 — 아래).

| 동작 | export | 검증 | DB 변경 | 감사 로그 action | 성공 문구 |
|---|---|---|---|---|---|
| 게시글 숨김/해제 | `setPostHiddenAction` | `toggleContentSchema` = `{ id: z.uuid('대상을 찾을 수 없습니다.'), on: z.enum(['0','1']) }` | `posts.is_hidden = on` | `community.post.hide` / `community.post.unhide` | `게시글을 숨김 처리했습니다.` / `게시글을 숨김 해제했습니다.` |
| 게시글 삭제/복구 | `setPostDeletedAction` | 〃 | `posts.deleted_at = on ? now() : null` | `community.post.delete` / `community.post.restore` | `게시글을 삭제했습니다.` / `게시글을 복구했습니다.` |
| 게시글 일괄 숨김 | `bulkHidePostsAction` | `bulkHideSchema`(1~100건) | `posts.is_hidden = true` (한 질의) | `community.post.bulk_hide` | `게시글 {n}건을 숨김 처리했습니다.` |
| 댓글 숨김/해제 | `setCommentHiddenAction` | `toggleContentSchema` | `comments.is_hidden` | `community.comment.hide` / `unhide` | `댓글을 숨김 처리했습니다.` / `댓글을 숨김 해제했습니다.` |
| 댓글 삭제/복구 | `setCommentDeletedAction` | 〃 | `comments.deleted_at` | `community.comment.delete` / `restore` | `댓글을 삭제했습니다.` / `댓글을 복구했습니다.` |
| 댓글 일괄 숨김 | `bulkHideCommentsAction` | `bulkHideSchema` | `comments.is_hidden = true` | `community.comment.bulk_hide` | `댓글 {n}건을 숨김 처리했습니다.` |
| (공용) 대상 숨김·삭제 | `moderateTarget(table, id, 'hide' \| 'delete')` | 인자 검증 없음(호출부가 이미 파싱) | 위와 같은 컬럼 | `community.{post\|comment}.{hide\|delete}` | `null`(성공) 또는 오류 문구 |

### 공통 흐름
1. **스냅샷 조회** `readSnapshots(table, ids)` → `{ id, is_hidden, deleted_at }` 맵. 대상이 없으면 `formError` `"{게시글|댓글}을 찾을 수 없습니다."`
2. **패치 적용** `applyPatch()` — 한 질의(`update(patch).in('id', ids)`). 일괄 숨김도 한 번에 끝낸다(행마다 액션을 부르면 Next 가 순차 디스패치해 20건이 20왕복이 된다).
3. **감사 로그** before `{ is_hidden, deleted_at }` / after = 적용한 패치.
4. **재검증** `revalidateFor(table)` → `revalidatePath('/community/posts' | '/community/comments')` + `revalidatePath('/reports')` + `revalidateClient(['community-list'])`.

### 일괄 숨김의 추가 규칙
- 이미 숨김이거나 삭제된 행은 **건너뛴다**(`targets = ids.filter(스냅샷이 있고 !isHidden && deletedAt === null)`) — 감사 로그에 무의미한 변경이 쌓이지 않게 한다.
- 남은 대상이 0건이면 `formError` `"이미 처리된 항목만 선택되었습니다."`
- 감사 로그는 **한 행**만 남긴다: `targetId` 없이 `after: { ids, count }`.
- 한 질의라 부분 실패가 없다 — 전부 숨겨지거나 전부 그대로다. 실패 문구도 그 사실을 적는다: `"선택한 항목을 숨기지 못했습니다. 아무 항목도 바뀌지 않았습니다. 다시 시도해 주세요."`

### `moderateTarget()` 만 다른 점
신고 처리(`resolveReportAction`)가 대상을 숨기거나 지울 때 부르는 공용 경로다.

| 항목 | 값 |
|---|---|
| 권한 | `requireAnyPermission(['community', 'reports'], 'write')`(아래) |
| 행위자 | **인자로 받지 않는다.**(아래) |
| 반환 | 성공 `null`, 실패는 사용자에게 보일 문구(`string`) |
| 모드 | `hide` → `is_hidden = true` / `delete` → `deleted_at = now()`. **해제·복구 모드는 없다** |

**동작 상세**
- **권한** — 신고를 종결하려면 대상 글을 숨겨야 하는데, 그때마다 커뮤니티 쓰기까지 요구하면 '신고 담당' 역할이 성립하지 않는다.
- **행위자** — `'use server'` 모듈의 export 는 전부 액션 엔드포인트로 열리므로, 행위자를 받으면 직접 POST 로 남의 이름을 적어 넣을 수 있다. 인가와 신원은 함수 안에서 다시 확인한다.

**오류·예외**
| 상황 | 결과 |
|---|---|
| `id` 가 uuid 가 아님 | `fieldErrors.id` "대상을 찾을 수 없습니다."(아래) |
| `on` 이 `'0'`/`'1'` 이 아님 | `fieldErrors.on` (zod 기본 문구) |
| 선택 0건으로 일괄 제출 | `formError` "대상을 한 건 이상 선택해 주세요."(아래) |
| 101건 이상 선택 | `formError` "한 번에 100건까지 처리할 수 있습니다."(아래) |
| DB 오류 | 위 표의 고정 문구 + `console.error()`(아래) |
| 권한 없음 | `/?error=forbidden` 리다이렉트 |
| 이미 삭제된 행에 삭제를 다시 검 | 막지 않는다. `deleted_at` 이 새 시각으로 덮인다(아래) |

- **`id` 가 uuid 가 아님** — 다이얼로그·바에는 이 필드를 그리는 자리가 없어 화면에는 아무 문구도 뜨지 않는다.
- **선택 0건으로 일괄 제출** — 버튼이 `disabled` 라 화면에서는 닿기 어렵다.
- **101건 이상 선택** — 한 페이지가 20건이라 화면에서는 닿지 않는다(직접 POST 방어).
- **DB 오류** — `console.error('[community] …', 원문)`. Postgres 원문은 화면에 노출하지 않는다(제약명·정책명이 새어 나간다).
- **이미 삭제된 행에 삭제를 다시 검** — 다이얼로그에서는 이미 "복구"로 바뀌어 있어 화면에서는 닿지 않는다.

**클라이언트와의 상호작용** 숨김·삭제·복구 모두 `community-list` 를 태워 사용자 사이트 `/community` 목록에 즉시 반영되고, 상세는 세션 조회라 더 먼저 바뀐다. 자세한 내용은 [01-posts.md](01-posts.md#클라이언트와의-상호작용) · [02-comments.md](02-comments.md#클라이언트와의-상호작용).
