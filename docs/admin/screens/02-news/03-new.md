# 새 뉴스 작성 (`/news/new`)

**목적** 카테고리를 고르면 그 카테고리의 템플릿으로 제목·요약·본문을 채우고, 임시저장 / 즉시 발행 / 예약 발행 중 하나로 저장한다. 저장에 성공하면 수정 화면(`/news/[id]`)으로 이동한다.

> 폼(`NewsForm`)은 수정 화면과 **같은 컴포넌트**다. 이 문서의 필드 표가 두 화면의 기준이고, 수정 화면에서만 달라지는 것은 [02-edit.md](02-edit.md) 에 적는다.

**데이터 출처**
- 진입 가드 `requirePermission('news', 'write')`.
- `listNewsCategories()` — 카테고리 select 옵션.
- `listNewsTemplateOptions()` — 카테고리별 템플릿(`{ categoryKey, title, summary, body, isActive }`). **조회가 깨지면 빈 배열**이라 카테고리를 골라도 아무 일도 일어나지 않는다(코드 기본값으로 대신 채우면 운영자가 꺼 둔 템플릿이 장애 중에만 되살아난다).
- `getPinnedNewsSummary()` — 고정 체크박스의 `n/3` 표시. 집계 실패면 `0` 으로 넘긴다.
- `export const dynamic = 'force-dynamic'` — 카테고리를 추가하거나 템플릿을 고쳐도 폼에 바로 나타나게 한다.
- 페이지 설명: "카테고리를 고르면 그 카테고리의 템플릿이 제목·본문을 채웁니다. 임시저장으로 두었다가 나중에 발행하거나, 시각을 지정해 예약 발행할 수 있습니다."

**레이아웃** 2열 그리드(`lg:grid-cols-[minmax(0,1fr)_320px]`). 왼쪽에 내용 카드 + 본문 에디터, 오른쪽에 "발행" 카드(`lg:sticky top-6`).

## 1.1 내용 카드
| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값·프리필 | 동작 / 상호작용 |
|---|---|---|---|---|
| 폼 배너 | `FormBanner` | — | 숨김 | `state.formError` 있을 때만 표시(아래) |
| 카테고리 | `Select` `name="categoryKey"` `required` (폭 max-240) | 필수(아래) | placeholder "선택하세요"(빈 값). 힌트는 새 글에서만(아래) | 프리필·저장(아래) |
| 제목 | `Input` `name="title"` `required` | 1~100자(아래) | 빈 값. 템플릿이 있고 제목이 비어 있으면 `title_template` 으로 채워진다 | 저장·힌트(아래) |
| 요약 | `Textarea` `name="summary"` rows=3 | 선택. 최대 200자(아래) | 빈 값. 요약이 비어 있을 때만 `summary_template` 으로 채워진다 | 힌트(아래) |
| 본문 | `PostEditor` `name="content"` | 필수(아래) | 빈 문서. 템플릿의 `body_template` 이 있으면 그대로 적용 | 에디터 동작(아래) |

**동작 상세**
- **폼 배너** — `state.formError` 가 있을 때만. 새 글 저장에서 나오는 값은 "저장하지 못했습니다. 잠시 후 다시 시도해 주세요."(`SAVE_FAILURE`).
- **카테고리(필수·제한)** — 필수. `newsFormSchema.categoryKey = z.enum(NEWS_CATEGORY_KEYS)`, 실패 문구 "카테고리를 선택해 주세요." DB 최종 방어선 FK `posts_category_fkey`.
- **카테고리(기본값·프리필)** — placeholder "선택하세요"(빈 값). 힌트 "고르면 그 카테고리의 템플릿이 제목·본문을 채웁니다." (새 글에서만 보인다).
- **카테고리(동작)** — 고르면 `prefill.selectCategory(value, readEditorBody(form))` → [1.4 템플릿 프리필 규칙](#14-템플릿-프리필-규칙). 저장 시 `posts.category_key`.
- **제목(필수·제한)** — 1~100자. `z.string().trim().min(1,'제목을 입력해 주세요.').max(NEWS_TITLE_MAX=100,'제목은 100자를 넘을 수 없습니다.')`. `maxLength={100}` 으로 브라우저에서도 막는다. **DB 에는 길이 제약이 없다** — 여기가 유일한 기준.
- **제목(동작)** — 저장 시 `posts.title`. 힌트: "사용자 사이트 목록에 한 줄로 보입니다. PC 약 59자 · 폰 약 18자를 넘으면 말줄임(…) 됩니다(상세 화면에는 전부 나옵니다)."
- **요약(필수·제한)** — 선택. 최대 200자(`NEWS_SUMMARY_MAX`), 실패 문구 "요약은 200자를 넘을 수 없습니다." 빈 문자열이면 `posts.summary = null` 로 저장.
- **요약(동작)** — 힌트: "목록에는 보이지 않습니다. 검색 결과·공유 카드 설명으로만 쓰입니다." — 실제로는 사용자 사이트 **카드형** 목록(`NewsCard`)이 요약 두 줄을 그린다(리스트형 `NewsRow` 는 그리지 않는다).
- **본문(필수·제한)** — 필수. `z.string().trim().min(1,'본문을 입력해 주세요.')` → 그다음 `sanitizePostHtml()` → 결과가 빈 문자열이면 필드 오류 "저장할 수 있는 본문이 없습니다." 길이 상한 없음.
- **본문(동작)** — 에디터가 **숨은 `<input name="content">`** 에 HTML 을 싣는다(에디터를 상위 폼 상태로 올리면 한 글자마다 리렌더돼 한글 조합이 끊긴다). 힌트: "이미지는 붙여넣기·드래그로도 올릴 수 있습니다." 저장 시 `posts.content` + `content_format='html'`.

## 1.2 본문 에디터 (`PostEditor` · Tiptap)
`immediatelyRender: false`(서버 렌더에서 하이드레이션 불일치를 막는다). 빈 문서는 `''` 로 눌러 내보낸다(`<p></p>` 를 그대로 보내면 검증이 "내용 있음"으로 읽는다). 에디터 로딩 전에는 `min-h-[320px] aria-busy` 자리만 그린다.

| 툴바 버튼 | `aria-label` | 명령 | 저장 후 태그 |
|---|---|---|---|
| B | 굵게 | `toggleBold()` | `<strong>` |
| I | 기울임 | `toggleItalic()` | `<em>` |
| U | 밑줄 | `toggleUnderline()` | `<u>` |
| S | 취소선 | `toggleStrike()` | `<s>` |
| H2 | 제목 | `toggleHeading({level:2})` | `<h2>` |
| H3 | 소제목 | `toggleHeading({level:3})` | `<h3>` |
| 목록 | 글머리 기호 목록 | `toggleBulletList()` | `<ul><li>` |
| 번호 | 번호 매기기 목록 | `toggleOrderedList()` | `<ol><li>` |
| 인용 | 인용 | `toggleBlockquote()` | `<blockquote>` |
| 링크 | 링크 | 인라인 입력칸(`InlineUrlField`) → `setLink({href})` | `<a href rel="noopener noreferrer nofollow" target="_blank">` |
| 이미지 | 이미지 첨부 | 숨은 file input 열기. 업로드 중에는 라벨이 `올리는 중` + `disabled` | `<img src alt>` |
| 영상 | 영상 첨부 | 인라인 입력칸 → `setVideoEmbed()` | `<div data-video="youtube:ID">` |

- 버튼은 전부 `type="button"` 이다(글쓰기 폼 안이라 type 을 빼면 굵게 한 번이 곧 저장이 된다). 토글 상태는 `aria-pressed`.
- **꺼 둔 기능**: h1, 코드/코드블록, 수평선(`horizontalRule`). 정제기 허용 목록에 없어 애초에 만들 수 없게 했다.
- 링크 입력 검증: `^https?://\S+$` 아니면 인라인 문구 "http:// 또는 https:// 로 시작하는 주소만 넣을 수 있습니다." (placeholder `https://example.com`)
- 영상 입력 검증: `parseVideoUrl()` 이 호스트 화이트리스트(youtube.com·youtu.be·m/music/nocookie, vimeo.com·player.vimeo.com)로 확인하고 id 형식(`[\w-]{6,20}` / 숫자 6~12)을 검사한다. 실패하면 "유튜브 또는 Vimeo 영상 주소를 넣어 주세요." (placeholder `https://www.youtube.com/watch?v=...`). 저장 형식은 iframe 이 아니라 **토큰**(`youtube:<id>`)이고, 표시 시점에 `renderPostHtml()` 이 `youtube-nocookie.com/embed/…` iframe 으로 조립한다.

**이미지 업로드** (`useImageUpload` → `uploadPostImageAction`)
| 항목 | 값 |
|---|---|
| 입력 경로 | 툴바 버튼 · 붙여넣기 · 드래그&드롭(아래) |
| 허용 형식 | JPEG·PNG·WEBP·GIF(`POST_IMAGE_ACCEPT`), 아니면 형식 오류(아래) |
| 크기 | `POST_IMAGE_MAX_BYTES = 5MB`, 0바이트도 거부(아래) |
| 업로드 전 축소 | `downscaleImage()` 가 긴 변 2000px 로 축소(아래) |
| 권한 | `requireAnyPermission(['news','legal'], 'write')` — 에디터를 뉴스·Legal 두 화면이 공유한다 |
| 저장 위치 | 버킷 `post-images`, 경로 `{uid}/{yyyy}/{uuid}.{ext}`(아래) |
| 순서 | **순차** 업로드, 일부 실패해도 나머지는 계속(아래) |
| 실패 문구 | "이미지를 올리지 못했습니다…"(아래) |
| 삽입 위치 | 현재 선택의 **뒤**에 삽입(아래) |

**동작 상세**
- **입력 경로** — 툴바 "이미지" 버튼 · 붙여넣기(`handlePaste`) · 드래그&드롭(`handleDrop`, 문서 내 노드 이동은 가로채지 않는다).
- **허용 형식** — `image/jpeg` · `image/png` · `image/webp` · `image/gif` (`POST_IMAGE_ACCEPT`). 아니면 "JPG · PNG · WEBP · GIF 이미지만 올릴 수 있습니다."
- **크기** — `POST_IMAGE_MAX_BYTES = 5MB`. 초과 시 "이미지는 5MB 이하만 올릴 수 있습니다." 0바이트면 "빈 파일은 올릴 수 없습니다."
- **업로드 전 축소** — `downscaleImage()` 가 긴 변 2000px 로 줄인다(품질 0.9). **GIF 는 건너뛴다**(캔버스를 거치면 첫 프레임만 남는다). 실패하거나 오히려 커지면 원본을 그대로 보낸다.
- **저장 위치** — 버킷 `post-images`, 경로 `{uid}/{yyyy}/{uuid}.{ext}`. 확장자는 **MIME 에서 정한다**(파일명 신뢰 금지). 스토리지 정책 `post_images_insert_own` 이 경로 첫 세그먼트 = `auth.uid()` 를 요구하므로 관리자도 같은 규칙을 따른다.
- **실패 문구** — "이미지를 올리지 못했습니다. 잠시 후 다시 시도해 주세요." — 에디터 아래 `role="alert"` 로 인라인 표시.
- **순서** — 여러 장을 **순차** 업로드한다(병렬이면 본문에 들어가는 순서가 고른 순서와 달라진다). 한 장이 실패해도 나머지는 계속 올리고, 오류 문구는 마지막 것만 남는다.
- **삽입 위치** — 현재 선택의 **뒤**(`insertContentAt(selection.to, …)`) — `setImage()` 는 선택을 덮어써서 직전에 넣은 이미지·영상을 갈아치운다.

## 1.3 발행 카드 (`NewsPublishFields`)
`fieldset` + legend "발행 설정".

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값·프리필 | 동작 / 상호작용 |
|---|---|---|---|---|
| 임시저장 | 라디오 `name="publishMode" value="draft"` | `z.enum(['draft','now','schedule'])`, 실패 문구 "발행 상태를 선택해 주세요." | **새 글의 기본 선택**(`initialMode(null) = 'draft'`) | 저장 규칙(아래) |
| 즉시 발행 | 라디오 `value="now"` | 위와 동일 | — | 저장: `is_published=true`, `published_at=now()` |
| 예약 발행 | 라디오 `value="schedule"` | 위와 동일 | — | 저장 규칙(아래) |
| 예약 시각 | `Input type="datetime-local"` `name="scheduledAt"` `required` | "예약 발행"일 때만 검사(아래) | 새 글은 빈 값 | 조건부 마운트(아래) |
| 상단 고정 | 체크박스 `name="isPinned"` | `z.boolean()`, 켜졌을 때만 전송(아래) | off | 표시·저장 규칙(아래) |
| 고정 오류 | `FormError` | — | 숨김 | `fieldErrors.isPinned`(아래) |
| 저장 | submit 버튼 | — | — | `saveNewsAction`. 처리 중 라벨 `저장 중…` + `disabled` |
| 목록으로 | 링크 버튼(secondary) | — | — | `/news` — **작성 중 내용은 저장되지 않는다**(확인 다이얼로그 없음) |

**동작 상세**
- **임시저장** — 설명 "사용자 사이트에 보이지 않습니다." 저장: `is_published=false`, `published_at` 은 기존 값 또는 `now()`(NOT NULL 이라 값이 필요하다).
- **즉시 발행** — 설명 "저장과 동시에 공개됩니다."
- **예약 발행** — 설명 "지정한 시각이 지나면 자동으로 공개됩니다." 저장: `is_published=true`, `published_at=` 지정 시각.
- **예약 시각(필수·제한)** — "예약 발행"일 때만 검사(`superRefine`). 비었으면 "예약 발행 시각을 입력해 주세요.", 형식 불일치면 "예약 시각 형식이 올바르지 않습니다.", **현재보다 과거·같으면** "예약 시각은 현재보다 뒤여야 합니다."
- **예약 시각(동작)** — **"예약 발행"을 골랐을 때만 마운트한다** — 숨기기만 하면 폼이 값을 계속 전송해, 임시저장으로 바꿔 저장한 뒤 다시 열었을 때 지난 예약 시각이 되살아난다. 힌트 "한국 시간(KST) 기준입니다."
- **상단 고정(필수·제한)** — `z.boolean()`. 체크박스는 켜졌을 때만 전송되므로 액션이 `formData.get('isPinned') !== null` 로 읽는다. 한도 3개.
- **상단 고정(동작)** — 라벨 옆에 `고정 {count}/{limit}` — `pinIndicator(otherPinnedCount, checked)` 로 **체크 상태를 반영한 실제 개수**를 보여 준다. `!checked && otherPinnedCount >= 3` 이면 `disabled` + title "상단 고정은 최대 3개까지 가능합니다." 저장: `posts.is_pinned`.
- **고정 오류** — `fieldErrors.isPinned` — 한도 초과 시 `"상단 고정은 최대 3개까지 가능합니다. 다른 글의 고정을 해제한 뒤 다시 시도해 주세요. (현재 고정: 제목A, 제목B, 제목C)"`.

## 1.4 템플릿 프리필 규칙
판정은 순수 함수 `decideNewsTemplateApply()` (`admin/lib/utils/news-template-prefill.ts`)가 하고, 상태 기계는 `useNewsTemplatePrefill()` 이 맡는다.

| 조건 | 결정 | 화면 동작 |
|---|---|---|
| 템플릿이 없거나 `isActive = false`, 또는 제목·요약·본문이 전부 빈 템플릿 | `none` | 아무 일도 일어나지 않는다(카테고리만 바뀐다) |
| 템플릿 본문이 비어 있음 | `apply` | 지울 본문이 없으니 묻지 않고 제목·요약만 채운다 |
| 지금 본문이 비어 있음(`isBlankPostHtml`) | `apply` | 바로 채운다 |
| 지금 본문이 **직전에 이 폼이 넣은 템플릿 그대로** | `apply` | 묻지 않고 갈아 끼운다(카테고리 연달아 변경, 아래) |
| 그 밖(운영자가 쓴 내용이 남아 있음) | `confirm` | 확인 다이얼로그를 연다 |

- **지금 본문이 직전에 이 폼이 넣은 템플릿 그대로** — 운영자가 쓴 글이 아니므로 묻지 않고 갈아 끼운다(카테고리를 연달아 바꿔 보는 흔한 동작).
- `isBlankPostHtml()`: 태그를 벗기고 `&nbsp;` 를 공백으로 바꿔 비었는지 본다. 단 **`<img` 또는 `data-video=` 가 있으면 비어 있지 않다**(글자가 없어도 붙여 넣은 이미지·영상을 말없이 지우지 않는다).
- 채우는 방식(`newsTemplatePatch()`): **제목·요약은 비어 있을 때만** 채우고, 본문은 템플릿 본문이 있으면 통째로 교체한다. 본문 교체는 `bodyKey` 를 올려 에디터를 새 초기값으로 다시 마운트하는 방식이다(에디터는 초기값으로만 본문을 받는다).
- 새 글에서는 카테고리를 고를 때 **자동 적용**한다(`isEdit = false`). 빈 값(`''`)을 고르면 아무 일도 하지 않는다.
- `{{날짜}}` 같은 자리표시자는 **치환되지 않는다**. 운영자가 작성하면서 직접 고쳐 쓰는 평문이다.

**템플릿 적용 확인 다이얼로그**
| 요소 | 문구 |
|---|---|
| 제목 | `템플릿 적용` |
| 설명 | `작성 중인 내용이 지워집니다. 템플릿을 적용할까요?` |
| 본문 | `{카테고리 라벨}` + ` 템플릿으로 본문을 갈아 끼웁니다.` |
| 버튼 | `취소` / `적용` |
| 취소 시 | 본문은 그대로 두고 **카테고리 변경만 남는다**(아래) |
| 확인 시 | 본문을 다시 읽지 않고 곧바로 덮어쓴다 |

- **취소 시** — 운영자가 바꾸려던 것은 글의 카테고리이고 템플릿은 그에 딸린 편의다.

## 1.5 저장 액션 계약 (`saveNewsAction` → `createNews`)
| 항목 | 값 |
|---|---|
| 파일 | `admin/lib/actions/news-actions.ts` |
| 권한 | `requirePermission('news', 'write')` (액션 자체에서) |
| 검증 | zod `newsFormSchema` (`admin/lib/validation/news.ts`) → 실패 시 `fieldErrors` |
| 분기 | 숨은 `id` 필드가 없으면(빈 문자열) 신규 INSERT |
| 고정 사전 검사 | `checkPinLimit(input, null)`(아래) |
| INSERT 컬럼 | `category_key`, `title`, `summary`, `content`, `content_format='html'` 등(아래) |
| 발행 시각 계산 | `resolvePublishPlan()` — 모드별 계산(아래) |
| 감사 로그 | 결과 상태가 `draft` 면 `news.create`, 아니면 `news.publish`. after 만 남긴다 |
| 재검증 | `revalidatePath('/news')` 항상 + 조건부 `news-list` 태그(아래) |
| 성공 | `redirect('/news/{새 id}')` — 수정 화면으로 이동한다(성공 토스트는 뜨지 않는다) |

**동작 상세**
- **고정 사전 검사** — `checkPinLimit(input, null)` — `isPinned` 이고 저장 결과가 발행(즉시·예약)일 때만 센다. 임시저장은 한도에 넣지 않는다.
- **INSERT 컬럼** — `category_key`, `title`, `summary`(빈 문자열 → `null`), `content`(정제 후), `content_format='html'`, `is_published`, `published_at`, `is_pinned`, `board='news'`, `author_id`=작성 관리자 id, `author_name`=관리자 닉네임.
- **발행 시각 계산** — `resolvePublishPlan()` — draft: `now()`(또는 기존 값 유지), schedule: `kstLocalToIso(scheduledAt)`, now: `now()`.
- **재검증** — `revalidatePath('/news')` 항상. 결과가 `draft` 가 아니면 태그 `news-list` 도 태운다(**재검증을 redirect 앞에 둔다** — `redirect()` 는 예외를 던져 이후 코드를 건너뛴다).

**KST 해석** `kstLocalToIso()` 는 `datetime-local` 의 "벽시계 문자열"을 UTC+9 로 **고정 해석**한다(`new Date(value)` 로 파싱하면 서버 로컬 타임존으로 읽혀 9시간이 어긋난다). `2026-02-31` 같은 오타는 `Date.UTC` 가 조용히 굴려 버리므로, 연·월·일이 그대로인지 다시 확인해 틀리면 `null`(형식 오류)로 떨어뜨린다.

**상태·뱃지 의미** 이 화면에는 뱃지가 없다. 저장 후 이동하는 수정 화면에서 편집 상태·클라이언트 노출 뱃지를 본다 → [README](README.md#편집-상태-vs-클라이언트-노출-두-축).

**클라이언트와의 상호작용**
- 임시저장으로 저장하면 사용자 사이트에 아무 영향이 없다(캐시도 태우지 않는다).
- 즉시 발행하면 `news-list` 재검증 직후부터 `/news` 목록에 뜬다. 카드형(`NewsCardGrid`→`NewsCard`)은 카테고리 뱃지·핀·제목·요약·발행일·조회수를, 리스트형(`NewsList`→`NewsRow`)은 요약을 뺀 같은 구성을 그린다.
- 예약 발행은 목록 캐시를 태우지만 `published_at > now()` 인 동안 RLS(`posts_select_published`)가 막아 보이지 않는다. **예약 시각이 지나면 별도 배치 없이** 다음 캐시 만료(최대 60초) 뒤 자연히 노출된다.
- 상세 `/news/[id]` 의 공유 카드(OG)는 `summary` 를 description 으로, 카테고리 배너 이미지를 대표 이미지로 쓴다(`app/(public)/news/[id]/page.tsx` 의 `generateMetadata`).

**오류·예외**
| 상황 | 결과 |
|---|---|
| 필수 누락·길이 초과 | 해당 입력 아래 필드 오류(위 표의 문구) |
| 본문이 정제 후 빈 문자열 | 필드 오류 `content` "저장할 수 있는 본문이 없습니다." |
| 과거 시각으로 예약 | 필드 오류 `scheduledAt`(아래) |
| 고정 한도 초과(사전 검사) | 필드 오류 `isPinned` + 현재 고정된 글 제목 |
| 고정 한도 초과(동시 요청이 사전 검사를 함께 통과) | DB 트리거 `news_pin_limit_exceeded`(아래) |
| 그 밖의 INSERT 실패 | 폼 배너 "저장하지 못했습니다. 잠시 후 다시 시도해 주세요."(아래) |
| 템플릿 조회 실패 | 카테고리를 골라도 프리필이 일어나지 않는다(빈 배열). 화면에 별도 안내는 없다 |
| 권한 없음 | 페이지 진입 시 `/?error=forbidden` 으로 리다이렉트 |

- **과거 시각으로 예약** — 필드 오류 `scheduledAt` "예약 시각은 현재보다 뒤여야 합니다."(RLS 는 `published_at <= now()` 만 보므로 그대로 두면 저장 즉시 공개된다).
- **고정 한도 초과(동시 요청)** — DB 트리거가 `news_pin_limit_exceeded` 를 던지고, `saveErrorState()` 가 같은 필드 오류로 옮긴다.
- **그 밖의 INSERT 실패** — `console.error('[news] 작성 실패', …)` 로도 남는다.
