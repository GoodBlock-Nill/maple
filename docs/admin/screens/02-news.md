# 뉴스 — 화면·기능 설명

> 관리자 콘솔(`admin/`)의 뉴스 메뉴. 경로 · 권한 · 화면 구성 · 동작(서버 액션) · 클라이언트(사용자 사이트)와의 상호작용을 개발 참고용으로 정리한다.
> 작성 규칙: 코드에서 확인한 사실만 쓴다. 파일 경로는 저장소 루트 기준. 워딩은 "카테고리"(말머리 금지).

## 0. 한눈에
| 항목 | 값 |
|---|---|
| 경로 | `/news` (하위: `/news/new`, `/news/[id]`, `/news/templates`, `/news/templates/[category]`) |
| 권한 모듈 | `news` — read(목록·보기) / write(작성·수정·템플릿·상태 변경) (`admin/lib/auth/permissions.ts`) |
| 주요 테이블 | `posts`(board='news'), `news_category_templates` |
| 클라이언트 영향 | 태그 `news-list` 재검증 → 사용자 사이트 `/news`, `/news/[id]` 목록에 즉시 반영(태그가 안 타면 최대 60초 뒤 반영). 템플릿 저장/복원은 사용자 사이트에 영향 없음(관리자 전용 테이블) |
| 관련 파일 | `admin/app/(admin)/news/**`, `admin/components/{news,news-templates}/**`, `admin/lib/actions/{news-actions,news-template-actions}.ts`, `admin/lib/data/{news,news-templates}.ts`, `admin/lib/validation/{news,news-templates}.ts` |

## 1. 뉴스 목록 (`/news`)
**목적** 뉴스 게시글을 조회·검색하고 숨김·삭제로 발행 상태를 관리한다.

**화면 구성**
- 필터: 카테고리(6종), 상태(발행/예약/임시저장/숨김/삭제), 고정만 보기, 검색어(제목·요약)
- 표 열: 선택 체크박스, 제목(고정 뱃지 + 수정 링크), 카테고리, "상태 · 노출"(편집 상태 뱃지 + 클라이언트 노출 뱃지 2종을 한 칸에), 발행일(정렬), 조회수(정렬), 수정일(정렬), 조치
- 버튼/액션: "카테고리 템플릿"·"새 뉴스 작성"(write만), 행별 수정/보기(사용자 사이트 새 탭)/숨김·해제/삭제(확인)·복구, 일괄 선택 숨김·일괄 선택 삭제(확인)
- 상단에 "총 N건 · 고정 x/3" 표시

**동작(서버 액션)**
| 동작 | 액션 함수 | 검증 | DB 변경 | 감사 로그 | 클라이언트 영향 |
|---|---|---|---|---|---|
| 행/일괄 숨김 | `newsStateAction(intent='hide')` (`admin/lib/actions/news-actions.ts`) | 수동 검증(zod 없음, `isNewsIntent`) | `posts.is_hidden=true` | `news.hide` | 태그 `news-list` |
| 행/일괄 숨김 해제 | `newsStateAction(intent='unhide')` | 위와 동일 | `posts.is_hidden=false` | `news.unhide`(※ 아래 주의) | 태그 `news-list` |
| 행/일괄 삭제 | `newsStateAction(intent='delete')` | 위와 동일 | `posts.deleted_at=now()` | `news.delete` | 태그 `news-list` |
| 행 복구 | `newsStateAction(intent='restore')` | 위와 동일 | `posts.deleted_at=null` | `news.restore` | 태그 `news-list` |

**클라이언트와의 상호작용**
- 사용자 사이트 `/news`(`app/(public)/news/page.tsx` → `lib/data/news.ts`의 `getNewsList`)가 `news-list` 태그로 `unstable_cache`(60초)된 목록을 읽는다. 관리자 쓰기 후 `revalidateClient(['news-list'])`가 사용자 사이트 `POST /api/revalidate`를 호출해 즉시 비운다.
- 클라이언트 목록은 `is_pinned desc, published_at desc`로 정렬 — 관리자의 "고정" 표시와 같은 축이다.

**주의**
- 상단 고정은 최대 3개(`NEWS_PIN_LIMIT`). DB 트리거 `guard_news_pin_limit`(마이그레이션 `20260911000500_news_pin_limit.sql`)이 최종 방어선이고, 서버 액션은 저장 전에 `getPinnedNewsSummary()`로 먼저 세어 친절한 안내를 낸다. 세는 대상은 "클라이언트에 실제로 뜰 수 있는" 글(발행 중 + 숨김·삭제 아님)뿐이다.
- 삭제된 글은 기본 목록에서 빠진다 — 상태 필터에서 "삭제"를 골라야 보인다(소프트 삭제, `deleted_at`).
- `newsStateAction`은 zod 스키마를 쓰지 않는다(`intent`·`ids`를 직접 읽어 검증).
- `news.unhide` 액션은 `admin/components/audit/audit-labels.ts`의 `VERB_LABELS`에 매핑이 없어, 감사 로그 목록에 라벨 대신 원문 액션 문자열이 그대로 노출될 수 있다.

## 2. 새 뉴스 작성 (`/news/new`)
**목적** 카테고리를 고르면 그 카테고리의 템플릿으로 제목·요약·본문을 채우고, 임시저장·즉시발행·예약발행 중 하나로 저장한다.

**화면 구성**
- 카테고리 select(고르면 템플릿 자동 프리필, 이미 작성한 내용이 있으면 확인 다이얼로그)
- 제목(≤100자), 요약(≤200자, 목록에는 안 보이고 검색 결과·공유 카드 설명으로만 쓰임), 본문 에디터(`PostEditor`, 이미지 붙여넣기·드래그 지원)
- 발행 설정: 임시저장 / 즉시 발행 / 예약 발행(KST datetime-local), 상단 고정 체크(현재 고정 개수/3, 한도 도달 시 비활성화)

**동작(서버 액션)**
| 동작 | 액션 함수 | 검증 | DB 변경 | 감사 로그 | 클라이언트 영향 |
|---|---|---|---|---|---|
| 저장 | `saveNewsAction`(신규, id 없음) (`admin/lib/actions/news-actions.ts`) | zod `newsFormSchema` (`admin/lib/validation/news.ts`) | `posts` INSERT(board='news', category_key, title, summary, content, content_format='html', is_published, published_at, is_pinned, author_id, author_name) | 임시저장이면 `news.create`, 발행/예약이면 `news.publish` | 임시저장이면 없음, 발행/예약이면 태그 `news-list` |

저장 성공 시 `/news/[id]`로 리다이렉트한다.

**클라이언트와의 상호작용**
- 임시저장 글은 사용자 사이트에 노출되지 않아 캐시를 태우지 않는다. 즉시/예약 발행만 목록에 반영된다.

**주의**
- 본문은 저장 직전 `sanitizePostHtml()`로 정제한다. 정제 후 빈 문자열이면(허용되지 않은 태그만 입력) "저장할 수 있는 본문이 없습니다" 오류를 낸다.
- 예약 시각은 KST로 해석하며 현재 시각보다 뒤여야 한다(과거 시각이면 저장 즉시 공개되어 운영자 의도와 어긋나므로 반려).
- 상단 고정 3개 한도는 목록 화면과 같다(위 참고).

## 3. 뉴스 수정 (`/news/[id]`)
**목적** 기존 글을 수정하고, 저장 없이도 사용자 사이트와 동일한 서식의 미리보기로 확인한다.

**화면 구성**
- 헤더에 작성자·조회수·최종 수정 시각, 편집 상태 뱃지 + 클라이언트 노출 뱃지, "클라이언트에서 보기"(새 탭) 버튼
- 새 글 작성과 같은 폼(`NewsForm`) + "템플릿 불러오기" 버튼(수정 화면 전용, 자동 프리필 없음 — 눌러야만 적용, 확인 다이얼로그)
- 하단에 `NewsPreview`: 사용자 사이트의 배너·카드 머리·본문 타이포그래피를 그대로 재현한 미리보기(저장된 값 기준, 편집 중인 내용은 반영 안 됨)

**동작(서버 액션)**
| 동작 | 액션 함수 | 검증 | DB 변경 | 감사 로그 | 클라이언트 영향 |
|---|---|---|---|---|---|
| 저장 | `saveNewsAction`(수정, id 있음) | zod `newsFormSchema` | `posts` UPDATE(동일 컬럼) | 임시저장→발행 전환이면 `news.publish`, 그 외는 `news.update` | 전/후 어느 한쪽이라도 임시저장이 아니면 태그 `news-list` |

저장은 리다이렉트 없이 같은 화면에 머물고 토스트로 완료를 알린다.

**클라이언트와의 상호작용**
- "클라이언트에서 보기"는 관리자 미리보기가 아니라 독자가 실제로 보는 `{사용자사이트}/news/[id]`를 새 탭으로 연다.
- 발행 중인 글을 임시저장으로 내리면 목록에서도 즉시 빠져야 하므로 캐시 태그를 태운다.

**주의**
- 상단 고정 집계(`getPinnedNewsSummary(post.id)`)는 이 글 자신을 제외하고 센다 — 이미 고정된 글을 그대로 저장할 때 스스로를 한도에 포함시키지 않기 위해서다.

## 4. 카테고리 템플릿 목록 (`/news/templates`)
**목적** 카테고리 6종별 글 양식(제목·요약·본문 템플릿)을 관리한다. 새 글 작성 화면에서 카테고리를 고르면 이 양식이 프리필된다.

**화면 구성**
- 카테고리 6종을 항상 모두 표시(공지사항·점검안내·업데이트 안내·패치노트·이벤트·안내사항) — DB에 저장된 적 없는 카테고리는 코드 기본값(시드)으로 채워 보여 준다
- 한 줄에: 카테고리 뱃지, 제목 템플릿 미리보기, 본문 템플릿 평문 발췌, 기본값/수정됨 표시 + 최종 수정 시각, 사용/사용 안 함(`is_active`) 뱃지, 수정 버튼

**동작(서버 액션)**
이 화면은 조회 전용이다. 항목별 편집은 3절로 이동해서 한다.

**클라이언트와의 상호작용**
- 없음. `news_category_templates`는 관리자만 읽는 테이블이며(RLS), 사용자 사이트는 이 테이블에 접근하지 않는다.

**주의**
- `news:write` 권한자에게만 노출된다(`admin/lib/nav.ts`). 편집·되돌리기 외에는 볼 것이 없는 화면이라 읽기 전용 관리자에게는 메뉴 자체를 감춘다.

## 5. 카테고리 템플릿 수정 (`/news/templates/[category]`)
**목적** 한 카테고리의 제목·요약·본문 템플릿을 고치거나 기본값으로 되돌린다.

**화면 구성**
- 제목 템플릿(≤100자, 제목이 비어 있을 때만 채움), 요약 템플릿(≤200자), 본문 템플릿 에디터(`PostEditor`, ≤20,000자, 뉴스 작성과 같은 정제기 사용)
- "새 글 작성 화면에서 이 카테고리를 고르면 템플릿 채우기" 체크(`is_active`)
- 헤더: 기본값/수정됨 뱃지, "기본값으로 되돌리기"(수정된 템플릿에만 노출, 확인 다이얼로그), 미리보기(`NewsTemplatePreview`, 저장된 값 기준)

**동작(서버 액션)**
| 동작 | 액션 함수 | 검증 | DB 변경 | 감사 로그 | 클라이언트 영향 |
|---|---|---|---|---|---|
| 저장 | `saveNewsTemplateAction` (`admin/lib/actions/news-template-actions.ts`) | zod `newsTemplateSchema` (`admin/lib/validation/news-templates.ts`) | `news_category_templates` UPSERT(onConflict `category_key`): title_template, summary_template, body_template, is_active, updated_by | `news_template.update` | 없음(관리자 전용 테이블) |
| 기본값으로 되돌리기 | `resetNewsTemplateAction` (같은 파일) | zod `newsTemplateCategorySchema` | 위와 동일 컬럼, 값은 코드 시드(`NEWS_TEMPLATE_SEEDS`)로. `is_active`는 유지 | `news_template.reset` | 없음 |

두 액션 모두 관리자 화면만 `revalidatePath`한다(`/news/templates`, `/news/templates/[category]`, `/news/new`) — 새 글 작성 화면이 서버에서 템플릿을 읽어 폼에 싣기 때문에 함께 비운다.

**클라이언트와의 상호작용**
- 없음. 이 테이블은 사용자 사이트가 읽지 않는다.

**주의**
- URL의 `[category]`가 6종 키가 아니면 404(`parseNewsTemplateCategory`).
- 되돌리기는 문안(제목·요약·본문)만 되돌린다 — 사용 여부(`is_active`)는 별개 결정이라 그대로 둔다.
- 되돌린 이전 문안은 화면 어디에도 남지 않고 감사 로그의 `before`에만 남는다.
- `{{날짜}}` 같은 자리표시자는 자동 치환되지 않는다 — 운영자가 작성 시 직접 고쳐 쓰는 평문이다.
