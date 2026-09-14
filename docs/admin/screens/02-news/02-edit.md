# 뉴스 수정 (`/news/[id]`)

**목적** 기존 뉴스를 고치고, 저장 없이도 사용자 사이트와 같은 서식의 미리보기로 결과를 확인한다. 관리자 콘솔에 별도의 "뉴스 상세" 화면은 없다 — 이 화면이 상세를 겸한다(작성자·조회수·상태·노출을 헤더에서 보여 준다).

**데이터 출처**
- 진입 가드 `requirePermission('news', 'write')` — **읽기 전용 관리자는 이 화면에 들어올 수 없다**(목록의 제목 링크를 눌러도 `/?error=forbidden` 으로 튕긴다).
- `getNewsPost(id)` (`admin/lib/data/news.ts`) — `posts` where `board='news' and id=…`. **삭제된 글도 읽는다**(복구 전에 내용을 확인해야 한다). uuid 가 아닌 id 는 22P02 로 떨어져 `null` → `notFound()`(404).
- `listNewsCategories()`, `listNewsTemplateOptions()` — 새 글 화면과 같다.
- `getPinnedNewsSummary(post.id)` — **이 글 자신을 제외하고** 센다(이미 고정된 글을 그대로 저장할 때 스스로를 한도에 포함시키지 않기 위해). `checkPinLimit(…, excludeId)` 와 같은 기준이다.
- `export const dynamic = 'force-dynamic'`.

## 1.1 헤더
| 필드/컨트롤 | 종류 | 값의 출처 | 표시 규칙 | 동작 |
|---|---|---|---|---|
| 제목 | `PageHeader` | 고정 문자열 | "뉴스 수정" | — |
| 설명 | 텍스트 | `authorName` · `viewCount` · `updatedAt` · `editedAt` | 조합 문구(아래) | `edited_at` 채움 규칙(아래) |
| 편집 상태 뱃지 | `Badge` | `deriveNewsStatus()` | 발행/예약/임시저장/숨김/삭제 | — |
| 클라이언트 노출 뱃지 | `Badge` | `deriveNewsVisibility()` | `클라이언트 노출 중` / `클라이언트 예약` / `클라이언트 비노출` | — |
| 클라이언트에서 보기 | 링크 버튼(secondary, `target="_blank" rel="noopener noreferrer"`) | `clientSiteUrl()` | 항상 표시 | 독자 페이지로 이동(아래) |

**동작 상세**
- **설명(표시 규칙)** — `{작성자} 작성 · 조회 {n} · 최종 수정 {YYYY-MM-DD HH:mm}` + `editedAt !== null` 이면 ` · 본문 수정 {…}`.
- **설명(동작)** — `edited_at` 은 트리거 `mark_post_edited` 가 제목·본문·요약·카테고리가 실제로 바뀐 순간에만 채운다(조회수 증가로도 밀리는 `updated_at` 과 구분).
- **클라이언트에서 보기** — `{NEXT_PUBLIC_CLIENT_SITE_URL}/news/{id}` — 관리자 미리보기가 아니라 **독자가 실제로 보는 페이지**. 비노출 상태면 404.

## 1.2 폼 (`NewsForm`)
필드 구성·검증·에디터 기능은 [03-new.md](03-new.md) 와 **완전히 같다**. 수정 화면에서만 다른 것:

| 필드/컨트롤 | 새 글과의 차이 |
|---|---|
| `id` | 숨은 `<input type="hidden" name="id" value={post.id}>` 추가(아래) |
| 카테고리 | 프리필 `post.categoryKey`. 템플릿 자동 적용 안 함(아래) |
| 템플릿 불러오기 | `isActive` 템플릿 있을 때만 노출되는 버튼(아래) |
| 제목 · 요약 · 본문 | 저장된 값이 초기값. 제목·요약은 제어 입력, 본문은 `PostEditor` 의 `defaultValue` |
| 발행 설정 초기 선택 | `initialMode(post)` 매핑(아래) |
| 예약 시각 | `scheduled` 일 때만 값 복원(아래) |
| 상단 고정 | 초기 체크 `post.isPinned`. `pinnedCount` 는 자기 자신 제외(아래) |
| 저장 결과 | **리다이렉트하지 않는다.** 같은 화면에 머물고 성공 토스트 "저장했습니다."를 띄운다 |

**동작 상세**
- **`id`** — 숨은 `<input type="hidden" name="id" value={post.id}>` 가 추가된다. 액션은 이 값으로 INSERT/UPDATE 를 분기한다.
- **카테고리** — 프리필 초기값 `post.categoryKey`. **카테고리를 바꿔도 템플릿이 자동 적용되지 않는다**(`isEdit = true`) — 발행된 글의 본문이 카테고리 한 번 바꿨다고 양식으로 덮이면 복구할 길이 없다. 힌트 문구도 표시되지 않는다.
- **템플릿 불러오기** — 카테고리 select 옆 버튼(secondary sm). **현재 카테고리에 `isActive = true` 인 템플릿이 있을 때만** 보인다(`prefill.hasTemplate`). 누르면 새 글과 같은 판정(`decideNewsTemplateApply`)을 거쳐 바로 적용하거나 "템플릿 적용" 확인 다이얼로그를 연다.
- **발행 설정 초기 선택** — `initialMode(post)` — `is_published = false` → `임시저장`, `status === 'scheduled'` → `예약 발행`, 그 외 → `즉시 발행`.
- **예약 시각** — `status === 'scheduled'` 일 때만 `isoToKstLocal(post.publishedAt)` 로 되살린다(`YYYY-MM-DDTHH:mm`). 그 외에는 빈 값.
- **상단 고정** — 초기 체크 상태 `post.isPinned`. `pinnedCount` 는 **이 글을 뺀** 수라, 이미 고정된 글은 체크를 자유롭게 풀 수 있고 한도에 닿았을 때 새로 켜는 것만 막힌다.

## 1.3 클라이언트 미리보기 (`NewsPreview`, `data-testid="news-preview"`)
폼 아래에 붙는 읽기 전용 카드. 사용자 사이트의 세 조각(카테고리 배너 · 상세 카드 머리 · 본문 타이포그래피)을 그대로 옮겼다.

| 요소 | 값의 출처 | 표시 규칙 |
|---|---|---|
| 카드 헤더 | 고정 문구 | 제목·설명·노출 뱃지(아래) |
| 배너 이미지 | `{clientSiteUrl}/images/news/banners/{categoryKey}.png` | 6종 외 키·비율·이미지 처리(아래) |
| 카테고리 뱃지 | `post.categoryKey` | `newsCategoryLabel()`/`newsCategoryTone()` |
| 제목 | `post.title` | `clamp(22px,3vw,32px)` |
| 메타 | `post.publishedAt`, `post.viewCount` | `{YYYY-MM-DD}` · `조회 {n}` |
| 본문 | `post.content` | `renderPostHtml()` 렌더링 규칙(아래) |
| 요약 | `post.summary` | 비어 있지 않을 때만 표시(아래) |

**편집 중인 내용은 반영되지 않는다** — 저장된 값만 그린다. 저장하면 페이지가 다시 렌더되면서 미리보기도 갱신된다.

**동작 상세**
- **카드 헤더** — 제목 "클라이언트 미리보기", 설명 "저장된 내용을 사용자 사이트와 같은 서식으로 그립니다. 편집 중인 내용은 저장해야 반영됩니다." + 우측에 노출 뱃지.
- **배너 이미지** — 6종 외의 키는 `notice` 배너로 떨어진다(사용자 사이트 `getNewsBanner` 와 동일). 비율 1200×628 고정. `next/image` 를 쓰지 않는다(배너 호스트가 환경마다 달라 `remotePatterns` 에 못 박을 수 없다).
- **본문** — `renderPostHtml()` 로 영상 토큰을 16:9 iframe 으로 바꾼 뒤 `dangerouslySetInnerHTML`. 입력은 이미 `sanitizePostHtml()` 을 통과한 값뿐이다.
- **요약** — 비어 있지 않을 때만 본문 아래 구분선 뒤에 "**요약** — 본문에는 보이지 않습니다. 검색 결과·공유 카드의 설명으로만 쓰입니다: {요약}".

## 1.4 저장 액션 계약 (`saveNewsAction` → `updateNews`)
| 항목 | 값 |
|---|---|
| 현재 값 조회 | `posts` 에서 스냅샷 컬럼을 먼저 읽는다(아래) |
| 고정 사전 검사 | `checkPinLimit(input, currentPublishState, postId)` — 자기 자신 제외 |
| UPDATE 컬럼 | `category_key`, `title`, `summary`, `content`, `content_format`, `is_published`, `published_at`, `is_pinned`(아래) |
| 발행 시각 유지 규칙 | `resolvePublishPlan(input, current)` — 3가지 케이스(아래) |
| 감사 로그 | `draft → 아님` 이면 `news.publish`, 그 밖은 `news.update`(아래) |
| 재검증 | `revalidatePath('/news')` + `revalidatePath('/news/{id}')` + 조건부 `news-list` 태그(아래) |
| 성공 | 리다이렉트 없음 + 토스트 "저장했습니다." |

**동작 상세**
- **현재 값 조회** — `id` + `board='news'` 로 스냅샷 컬럼(`id, title, category_key, is_published, published_at, is_hidden, deleted_at`)을 먼저 읽는다. 없으면 `formError` "글을 찾을 수 없습니다.".
- **UPDATE 컬럼** — **`is_hidden`·`deleted_at` 은 건드리지 않는다**(목록의 상태 변경 전용).
- **발행 시각 유지 규칙** — ① 임시저장으로 내려도 기존 `published_at` 을 **유지**한다(NOT NULL 이고, 다시 발행할 때 최초 발행일이 살아난다) ② "즉시 발행"인데 이미 공개 중이고 `published_at <= now()` 면 **최초 발행 시각을 지킨다**(오타 하나 고쳤다고 발행일이 오늘로 바뀌면 독자에게 새 글로 올라온 것처럼 보인다) ③ 예약이면 지정 시각.
- **감사 로그** — `before.status === 'draft' && after.status !== 'draft'` 면 `news.publish`, 그 밖에는 `news.update`. before+after 모두 기록.
- **재검증** — **전/후 어느 한쪽이라도 `draft` 가 아니면** 태그 `news-list` 도 태운다(발행 → 임시저장으로 내린 경우에도 목록에서 빠져야 한다).

**상태·뱃지 의미** → [README 의 두 축 표](README.md#편집-상태-vs-클라이언트-노출-두-축).

**클라이언트와의 상호작용**
- 발행 중인 글을 수정하면 `news-list` 를 태워 사용자 목록의 제목·요약·카테고리·고정 순서가 즉시 갱신된다. 상세는 세션 조회라 태그와 무관하게 바로 바뀐다.
- 발행 → 임시저장으로 내리면 목록에서 빠지고 상세는 404 가 된다(`getNewsById` 는 `deleted_at is null` 만 명시하고, `is_published` 조건은 RLS 가 건다).
- 본문을 고치면 트리거 `mark_post_edited` 가 `edited_at` 을 채우고, 사용자 사이트 상세에 "수정됨" 표시가 붙는다(`isEdited(item.editedAt)` → `app/(public)/news/[id]/page.tsx`).
- 고정을 켜면 사용자 목록에서 맨 위로 올라가고 카드 머리 오른쪽에 핀 아이콘이 붙는다(`NewsCardHead`).
- 관리자가 이 화면에서 조회수를 바꾸는 경로는 없다. `view_count` 는 사용자 사이트의 `ViewCounter` 가 올린다.

**오류·예외**
| 상황 | 결과 |
|---|---|
| 없는 id · uuid 형식 아님 | `notFound()` → 404 화면 |
| 다른 운영자가 먼저 지운 글 | 조회는 되지만 저장은 그대로 성공한다(아래) |
| 스냅샷 조회 실패 | 폼 배너 "글을 찾을 수 없습니다." |
| 고정 한도 초과 | `isPinned` 필드 오류(사전 검사 또는 트리거) |
| 그 밖의 UPDATE 실패 | 폼 배너 "저장하지 못했습니다. 잠시 후 다시 시도해 주세요."(아래) |
| 동시 편집 | **잠금·버전 검사가 없다.** 마지막 쓰기 승리(아래) |
| 읽기 전용 관리자 | 화면 진입 자체가 막힌다(`requirePermission('news','write')`) |

- **다른 운영자가 먼저 지운 글** — 조회는 되지만(삭제된 글도 읽는다) 저장은 그대로 성공한다 — 삭제 상태는 유지되고 `deleted_at` 은 덮이지 않는다.
- **그 밖의 UPDATE 실패** — `console.error('[news] 수정 실패', …)` 로도 남는다.
- **동시 편집** — 나중에 저장한 쪽이 이긴다(마지막 쓰기 승리). 충돌 안내도 없다.
