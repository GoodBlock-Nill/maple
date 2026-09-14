# 뉴스 — 메뉴 개요

> 관리자 콘솔(`admin/`)의 뉴스 메뉴. 사용자 사이트 `/news` 에 뜨는 글을 작성·수정하고 발행 상태(발행·예약·임시저장·숨김·삭제·고정)를 관리한다.
> 작성 규칙: 코드에서 확인한 사실만 쓴다. 파일 경로는 저장소 루트 기준. 워딩은 "카테고리".

## 0. 한눈에
| 항목 | 값 |
|---|---|
| 경로 | `/news` (하위: `/news/new`, `/news/[id]`, `/news/templates`, `/news/templates/[category]`) |
| 권한 모듈 | `news` — read / write (`admin/lib/auth/permissions.ts`). **read**: 목록 조회·필터·정렬·페이지 이동만(선택 열과 행 조치 열이 통째로 빠진다, `buildNewsColumns()`). **write**: "새 뉴스 작성"·"카테고리 템플릿" 버튼, 일괄 숨김/삭제 바, 행별 수정/숨김/삭제/복구, `/news/new`·`/news/[id]`·`/news/templates*` 진입 |
| 주요 테이블 | `posts`(board='news' — `title`·`summary`·`content`·`content_format`·`category_key`·`is_published`·`published_at`·`is_pinned`·`is_hidden`·`deleted_at`·`view_count`·`author_id`·`author_name`·`edited_at`), `news_category_templates`(카테고리당 1행), `board_categories`(board='news' — 카테고리 라벨·순서) |
| 클라이언트 영향 | 태그 `news-list` 재검증 → 사용자 사이트 `/news`(`app/(public)/news/page.tsx` → `lib/data/news.ts` 의 `getNewsList`, `unstable_cache` 60초) 목록이 즉시 갱신. 상세 `/news/[id]` 는 `getNewsById()` 가 매 요청 세션 조회라 태그와 무관하게 바로 반영. 템플릿 저장·복원은 클라이언트에 영향 없음(관리자 전용 테이블) |
| 관련 파일 | 페이지 `admin/app/(admin)/news/**` · 컴포넌트 `admin/components/news/**`, `admin/components/news-templates/**`, `admin/components/editor/**` · 액션 `admin/lib/actions/{news-actions,news-template-actions}.ts`, `admin/components/editor/upload-action.ts` · 데이터 `admin/lib/data/{news,news-templates}.ts` · 검증 `admin/lib/validation/{news,news-templates}.ts` · 상수 `admin/lib/constants/{news,news-templates,field-limits,messages}.ts` · 정제 `admin/lib/sanitize/{post-html,video-embed,render-post-html}.ts` · 캐시 `admin/lib/revalidate.ts` · 마이그레이션 `20260908000300_boards_posts_comments`, `20260908001600_news_categories`, `20260908001700_admin_foundation`, `20260908001100_reports_and_author_edits`, `20260911000100_news_category_templates`, `20260911000500_news_pin_limit` |

## 화면 목록
| 파일 | 경로 | 설명 |
|---|---|---|
| [01-list.md](01-list.md) | `/news` | 목록 · 필터(카테고리·상태·고정·검색) · 정렬 · 일괄 숨김/삭제 · 행 조치 |
| [02-edit.md](02-edit.md) | `/news/[id]` | 뉴스 수정. 상세 화면을 겸한다(조회수·상태·노출 뱃지 + 클라이언트 미리보기) |
| [03-new.md](03-new.md) | `/news/new` | 새 뉴스 작성. 카테고리를 고르면 템플릿이 제목·요약·본문을 채운다 |
| [04-templates.md](04-templates.md) | `/news/templates` | 카테고리 6종 템플릿 목록 |
| [05-templates-edit.md](05-templates-edit.md) | `/news/templates/[category]` | 한 카테고리의 제목·요약·본문 템플릿 편집 · 기본값 복원 |

작성 폼(`NewsForm`)은 `/news/new` 와 `/news/[id]` 가 **같은 컴포넌트**를 쓴다. 필드 표는 [03-new.md](03-new.md) 에 전부 적고, [02-edit.md](02-edit.md) 는 수정 화면에서만 달라지는 것(숨은 `id`, 프리필, 템플릿 불러오기 버튼, 고정 집계 기준, 감사 로그 action, 미리보기)만 다룬다.

## 메뉴 전체 규칙

### 카테고리 6종 (고정)
`NEWS_CATEGORY_KEYS` (`admin/lib/constants/news.ts`) = `notice`·`maintenance`·`update`·`patch`·`event`·`info`. 배열 순서가 곧 화면 순서이고, 마이그레이션 `20260908001600_news_categories` 의 `sort_order` 와 같다.

| key | 라벨 | 뱃지 톤 | 사용자 사이트 뱃지 색(`lib/constants/board.ts`) |
|---|---|---|---|
| `notice` | 공지사항 | accent | `notice` |
| `maintenance` | 점검안내 | warn | `maintenance` |
| `update` | 업데이트 안내 | success | `update` |
| `patch` | 패치노트 | neutral | `patch` |
| `event` | 이벤트 | accent | `event` |
| `info` | 안내사항 | neutral | `news-info` |

- 폼 select 의 옵션은 `listNewsCategories()` 가 DB(`board_categories` where `board='news'` and `is_active`)에서 `sort_order` 순으로 읽는다. 조회가 실패하거나 비면 위 상수로 떨어진다(카테고리를 못 읽었다고 글쓰기가 막히지 않는다).
- 저장 검증은 zod `z.enum(NEWS_CATEGORY_KEYS)` 이고, 최종 방어선은 FK `posts_category_fkey (board, category_key) → board_categories(board, key)` 다.
- 알 수 없는 키는 목록에서 라벨 대신 키 원문 + `neutral` 톤으로 그린다(`newsCategoryLabel()` · `newsCategoryTone()`).

### 편집 상태 vs 클라이언트 노출 (두 축)
목록·수정 화면이 뱃지 두 개를 나란히 보여 준다. 기준이 다르므로 둘 중 하나만 보고 판단하면 어긋난다.

| 축 | 함수 | 값 | 판정식 |
|---|---|---|---|
| 편집 상태 `NewsStatus` | `deriveNewsStatus()` | `deleted` → `hidden` → `draft` → `scheduled` → `published` (위에서부터 우선) | `deleted_at != null` / `is_hidden` / `!is_published` / `published_at > now()` / 그 외 |
| 클라이언트 노출 `NewsVisibility` | `deriveNewsVisibility()` | `invisible` · `scheduled` · `visible` | `deleted_at != null \|\| is_hidden \|\| !is_published` → invisible, `published_at > now()` → scheduled, 그 외 visible |

노출 판정식은 공개 SELECT 정책 `posts_select_published`(`is_published and deleted_at is null and not is_hidden and published_at <= now()`, 마이그레이션 `20260908001700`)를 그대로 옮긴 것이다.

| 상태 | 라벨 | 톤 | 노출 | 라벨 | 톤 |
|---|---|---|---|---|---|
| `published` | 발행 | success | `visible` | 노출 중 | success |
| `scheduled` | 예약 | accent | `scheduled` | 예약 | accent |
| `draft` | 임시저장 | neutral | `invisible` | 비노출 | neutral |
| `hidden` | 숨김 | warn | | | |
| `deleted` | 삭제 | danger | | | |

### 상단 고정 3개 한도
- 상수 `NEWS_PIN_LIMIT = 3`, 문구 `NEWS_PIN_LIMIT_MESSAGE` = "상단 고정은 최대 3개까지 가능합니다. 다른 글의 고정을 해제한 뒤 다시 시도해 주세요."
- **세는 대상**: `board='news' and is_pinned and is_published and not is_hidden and deleted_at is null`. 예약 글(미래 `published_at`)은 포함하고, 임시저장·숨김·삭제 글의 고정 표시는 세지 않는다.
- 3중 방어: 화면(`pinIndicator()` 가 한도 도달 시 체크박스를 `disabled`) → 서버 액션 사전 검사(`checkPinLimit()` → 필드 오류 + 현재 고정 글 제목) → DB 트리거 `guard_news_pin_limit`(`20260911000500_news_pin_limit.sql`, `raise exception 'news_pin_limit_exceeded'`). 세는 조건 셋이 모두 같다.
- 트리거가 던진 `news_pin_limit_exceeded` 는 `isPinLimitTriggerError()` 가 잡아 같은 한국어 문구로 옮긴다(원문은 화면에 노출하지 않는다).

### 본문 정제 (`sanitizePostHtml`)
뉴스 본문과 템플릿 본문이 **같은 정제기**를 통과한다. 출력만 DB 에 저장되고, 에디터를 우회한 직접 POST 도 같은 규칙을 받는다.

| 항목 | 허용 |
|---|---|
| 태그 | `p` `br` `strong` `em` `s` `u` `h2` `h3` `ul` `ol` `li` `blockquote` `a` `img` `div`(영상 자리표시자 전용) |
| 속성 | `a`: `href`·`rel`·`target` / `img`: `src`·`alt`·`width`·`height` / `div`: `data-video`. 그 밖(`style`·`class`·`on*`)은 전부 제거 |
| 링크 | `^https?://\S+$` 만 남기고, `rel="noopener noreferrer nofollow" target="_blank"` 를 **강제로 덮어쓴다**. 아니면 태그째 사라진다 |
| 이미지 | `{SUPABASE_URL}/storage/v1/object/public/post-images/` 로 시작하는 `src` 만. 외부 URL 은 제거. `width`/`height` 는 숫자 1~4자리만 |
| 영상 | `data-video="youtube:<id>" \| "vimeo:<id>"` 토큰만. `parseVideoToken()` 이 형식을 다시 검사한다 |
| 통째로 버림 | `script` `style` `textarea` `option` `noscript` `template` `iframe` (내용 포함) |
| 기타 | 프로토콜 상대 URL(`//host`) 금지, `img` 는 https 만, 끝의 빈 문단(`<p></p>`) 제거 |

정제 후 빈 문자열이면 뉴스 본문은 "저장할 수 있는 본문이 없습니다."(필드 오류 `content`), 템플릿 본문은 입력이 있었을 때만 같은 문구(필드 오류 `body`)를 낸다.

### 감사 로그
| action | 언제 | 대상 | before/after |
|---|---|---|---|
| `news.create` | 새 글을 임시저장으로 저장 | `posts` / 새 id | after 만 |
| `news.publish` | 새 글을 즉시/예약 발행, 또는 임시저장 글을 발행으로 전환 | `posts` | 신규는 after 만, 전환은 before+after |
| `news.update` | 그 밖의 수정 | `posts` | before+after |
| `news.hide` / `news.unhide` / `news.delete` / `news.restore` | 목록의 상태 변경(행·일괄 모두, **대상 1건마다 1행**) | `posts` | before+after |
| `news_template.update` / `news_template.reset` | 템플릿 저장 / 기본값 복원 | `news_category_templates` | before(없으면 null)+after |

- 스냅샷은 `newsAuditSnapshot()` 이 만든 `{ title, category_key, status }` 세 칸뿐이다. **본문은 남기지 않는다**(수십 KB HTML 이 행마다 두 벌씩 쌓이면 감사 로그가 백업본이 된다).
- 라벨 매핑(`admin/components/audit/audit-labels.ts`): `news` → "뉴스", `news_template` → "뉴스 카테고리 템플릿"; `create`→등록, `publish`→발행, `update`→수정, `delete`→삭제, `hide`→숨김, `restore`→복구, `reset`→기본값 복원. **`unhide` 는 `VERB_LABELS` 에 없다** — `news.unhide` 는 감사 로그 목록에서 라벨 대신 원문 문자열 `news.unhide` 로 보인다.

### 캐시 재검증
- `revalidateNewsList()` = `revalidateClient([CLIENT_CACHE_TAGS.newsList])` → 사용자 사이트 `POST /api/revalidate`(헤더 `x-revalidate-secret`, 본문 `{ tags: ['news-list'] }`, 타임아웃 5초) → 그쪽에서 `revalidateTag('news-list', { expire: 0 })`.
- **부르지 않는 경우**: 임시저장 → 임시저장 수정(전/후 모두 `draft`). 남의 캐시를 이유 없이 비우지 않는다.
- 실패해도 저장은 성공으로 처리한다(`revalidateClient` 는 절대 던지지 않는다). 이때는 태그의 원래 수명(60초) 뒤에 반영된다. `CLIENT_SITE_URL`/`REVALIDATE_SECRET` 이 비어 있으면 `console.warn` 만 남기고 건너뛴다.
- 관리자 화면 자체는 `revalidatePath('/news')`(+수정 시 `/news/[id]`)로 갱신한다. 템플릿 액션은 `/news/templates`, `/news/templates/[category]`, **`/news/new`** 세 곳을 비운다.
