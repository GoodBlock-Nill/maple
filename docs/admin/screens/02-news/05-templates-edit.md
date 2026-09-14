# 카테고리 템플릿 수정 (`/news/templates/[category]`)

**목적** 한 카테고리의 제목·요약·본문 템플릿을 고치거나 처음 배포된 기본값으로 되돌린다. 이 카테고리에서 템플릿을 쓸지(`is_active`)도 여기서 정한다.

**데이터 출처**
- 진입 가드 `requirePermission('news', 'write')`.
- `parseNewsTemplateCategory(param)` — 라우트 파라미터를 `z.enum(NEWS_CATEGORY_KEYS)` 로 좁힌다. **6종 키가 아니면 `notFound()`(404)**. 빈 폼을 열어 주면 FK 가 막는, 이유를 알 수 없는 저장 실패를 겪게 된다.
- `getNewsTemplate(category)` — `news_category_templates` 단건. 행이 없거나 조회가 실패하면 코드 시드로 연다(`fromSeed()` — `id: null`, `isActive: true`, `isDefault: true`, `updatedAt: null`).
- `export const dynamic = 'force-dynamic'`.

## 1.1 헤더
| 필드/컨트롤 | 종류 | 필수·제한 | 값 | 동작 / 상호작용 |
|---|---|---|---|---|
| 제목 | `PageHeader` | — | `{카테고리 라벨} 템플릿` (예: "공지사항 템플릿") | — |
| 설명 | 텍스트 | — | `updatedAt === null` → "아직 저장된 적 없는 기본 템플릿입니다. 저장하면 이 카테고리의 양식이 됩니다." / 그 외 → `최종 수정 {YYYY-MM-DD HH:mm}` | — |
| 기본값 / 수정됨 | `Badge` | — | `isDefault ? '기본값'(neutral) : '수정됨'(accent)` | — |
| 기본값으로 되돌리기 | 버튼(secondary sm) | **`isDefault` 면 렌더하지 않는다** | — | 확인 다이얼로그를 연다(아래 1.3). 편집 폼 **밖**(헤더)에 둔다 — 되돌리기도 서버 액션 폼이라 안에 넣으면 폼이 중첩된다 |
| 템플릿 목록 | 링크 버튼(secondary) | — | — | `/news/templates` |

## 1.2 편집 폼 (`NewsTemplateForm`)
| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값·프리필 | 동작 / 상호작용 |
|---|---|---|---|---|
| 카테고리 | hidden input `name="category"` | `newsTemplateSchema.category = z.enum(NEWS_CATEGORY_KEYS)`, 실패 문구 "카테고리를 선택해 주세요." | 라우트 파라미터 | 저장 시 upsert 의 충돌 키 |
| 폼 배너 | `FormBanner` | — | 숨김 | `state.formError` — 저장 실패 문구 |
| 제목 템플릿 | `Input` `name="title"` | **선택**(비워도 저장된다). 최대 `NEWS_TEMPLATE_TITLE_MAX = NEWS_TITLE_MAX = 100`, 문구 "제목 템플릿은 100자를 넘을 수 없습니다." DB CHECK `news_category_templates_title_length (char_length <= 100)` | 저장된 `title_template`(없으면 시드) | 힌트 "새 글의 제목 칸이 비어 있을 때만 채웁니다. 운영자가 쓴 제목은 덮지 않습니다." 저장 시 `title_template` |
| 요약 템플릿 | `Textarea` `name="summary"` rows=2 | 선택. 최대 `NEWS_TEMPLATE_SUMMARY_MAX = NEWS_SUMMARY_MAX = 200`, 문구 "요약 템플릿은 200자를 넘을 수 없습니다." DB CHECK `news_category_templates_summary_length (<= 200)` | 저장된 `summary_template` | 힌트 "요약 칸이 비어 있을 때만 채웁니다. 목록에는 보이지 않고 검색 결과·공유 카드 설명으로 쓰입니다." |
| 템플릿 사용 | 체크박스 `name="isActive"` | `z.boolean()`. 체크박스는 켜졌을 때만 전송되므로 액션이 `formData.get('isActive') !== null` 로 읽는다 | 저장된 `is_active`(행이 없으면 체크됨) | 라벨 "새 글 작성 화면에서 이 카테고리를 고르면 템플릿 채우기". 끄면 새 글 폼이 이 카테고리에서 아무것도 채우지 않고, 수정 화면의 "템플릿 불러오기" 버튼도 사라진다 |
| 본문 템플릿 | `PostEditor` `name="body"` | 선택(비어 있어도 저장한다 — 제목만 정해 두고 본문은 매번 새로 쓰는 카테고리가 있다). 최대 `NEWS_TEMPLATE_BODY_MAX = 20,000`자, 문구 "본문 템플릿은 20,000자를 넘을 수 없습니다." DB CHECK `news_category_templates_body_length (<= 20000)` | 저장된 `body_template` | **뉴스 본문과 같은 에디터·같은 정제기**를 쓴다(툴바·이미지 업로드·영상 임베드 전부 동일 → [03-new.md §1.2](03-new.md#12-본문-에디터-posteditor--tiptap)). 다른 편집기를 쓰면 여기서 만든 서식이 글 화면에서 다르게 보인다. 힌트 "새 글의 본문을 이 내용으로 채웁니다. {{날짜}} 처럼 적어 둔 자리는 자동으로 바뀌지 않습니다 — 작성할 때 직접 고쳐 씁니다." |
| 저장 | submit 버튼 | — | — | `saveNewsTemplateAction`. 처리 중 `저장 중…` + `disabled`. 성공 시 **리다이렉트 없이** 토스트 `"{카테고리 라벨} 템플릿을 저장했습니다."` |
| 목록으로 | 링크 버튼(secondary) | — | — | `/news/templates` |

**입력 정규화** `optionalText()` 가 CRLF(`\r\n`·`\r`)를 LF 로 눌러 `trim()` 한 뒤 길이를 잰다(에디터·DB 가 한 모양만 보게 한다).

**상한이 글 필드와 같은 이유** 템플릿은 그대로 새 글 폼에 들어간다. 여기가 더 관대하면 "불러왔는데 글로는 저장할 수 없는" 문안이 만들어진다. 본문만 별도 상한(20,000)인데, `posts.content` 에는 길이 제약이 없지만 템플릿은 "채워 넣을 뼈대"라 완성된 글보다 길 이유가 없기 때문이다.

## 1.3 기본값 복원 다이얼로그 (`NewsTemplateResetButton`)
| 요소 | 문구·동작 |
|---|---|
| 제목 | `템플릿 기본값 복원` |
| 설명 | `지금 저장된 문안을 처음 배포된 기본 템플릿으로 덮어씁니다. 고쳐 둔 내용은 감사 로그에만 남습니다. 사용 여부(켜짐/꺼짐)는 그대로 두고, 되돌린 뒤에는 템플릿 목록으로 돌아갑니다.` |
| 본문 | `{카테고리 라벨}` + ` 템플릿을 기본값으로 되돌립니다.` |
| 폼 | `<input type="hidden" name="category">` 하나 |
| 배너 | `state.formError` — "카테고리를 찾을 수 없습니다." 또는 "기본값으로 되돌리지 못했습니다. 잠시 후 다시 시도해 주세요." |
| 버튼 | `취소` / `되돌리기`(danger, 처리 중 `되돌리는 중…`) |
| 성공 | 토스트 `"{카테고리 라벨} 템플릿을 기본값으로 되돌렸습니다."` → **`/news/templates` 로 이동**(`router.push`). 편집 폼의 입력과 에디터는 비제어라 그 자리에 머물면 서버가 되돌린 문안 대신 화면에 남아 있던 옛 문안을 계속 보여 준다. 목록에서는 그 카테고리가 '기본값'으로 찍혀 무엇이 일어났는지가 화면에 남는다 |

## 1.4 미리보기 (`NewsTemplatePreview`, `data-testid="news-template-preview"`)
| 요소 | 값 | 표시 규칙 |
|---|---|---|
| 카드 헤더 | 고정 문구 | "템플릿 미리보기" / "저장된 템플릿을 사용자 사이트와 같은 서식으로 그립니다. 편집 중인 내용은 저장해야 반영됩니다." |
| 제목 | `template.title` | 비어 있으면 `(제목 템플릿 없음)` |
| 요약 | `template.summary` | 비어 있으면 줄 자체를 그리지 않는다 |
| 본문 | `template.body` | 비어 있으면 "본문 템플릿이 비어 있습니다." / 그 외에는 `renderPostHtml()` + 뉴스 미리보기와 같은 타이포그래피(`PREVIEW_PROSE_CLASS`) |

**저장된 값만 그린다** — 에디터의 임시 상태까지 따라 그리면 "미리보기에는 있는데 저장된 적 없는" 문안이 생긴다.

## 1.5 서버 액션 계약
| 동작 | 액션 함수 | 검증 | DB 변경 | 감사 로그 | 클라이언트 영향 |
|---|---|---|---|---|---|
| 저장 | `saveNewsTemplateAction` (`admin/lib/actions/news-template-actions.ts`) | zod `newsTemplateSchema` + `sanitizePostHtml(body)` | `news_category_templates` **UPSERT**(`onConflict: 'category_key'`): `title_template`, `summary_template`, `body_template`, `is_active`, `updated_by = 액션 수행자 id` | `news_template.update` — before 는 갱신 전 행(없으면 `null`), after 는 저장 값 | 없음 |
| 기본값 복원 | `resetNewsTemplateAction` (같은 파일) | zod `newsTemplateCategorySchema` | 같은 UPSERT. 값은 코드 시드(`newsTemplateSeed(category)`), **`is_active` 는 기존 값을 유지**(행이 없으면 `true`) | `news_template.reset` | 없음 |

- 두 액션 모두 첫 줄에서 `requirePermission('news', 'write')` 를 부른다(서버 액션은 UI 를 거치지 않는 직접 POST 로도 호출된다). 쓰기는 세션 클라이언트로만 해서 RLS 가 다시 검사하게 둔다.
- 재검증은 관리자 경로 세 곳: `/news/templates`, `/news/templates/{category}`, **`/news/new`**. 새 글 작성 화면이 템플릿을 서버에서 읽어 폼에 싣기 때문에 함께 비우지 않으면 방금 고친 문안이 다음 글에 반영되지 않는다.
- **사용자 사이트 캐시는 태우지 않는다.** 템플릿은 글이 되기 전의 양식이고 사용자 사이트는 이 테이블을 읽지도 못한다("남의 캐시를 이유 없이 비우지 않는다" — `admin/lib/revalidate.ts`).
- 되돌리기는 **문안 셋만** 되돌린다. 사용 여부는 "이 카테고리에서 템플릿을 쓸 것인가"라는 별개의 결정이다.
- 되돌린 이전 문안은 화면 어디에도 남지 않고 `audit_logs.before` 에만 남는다.

**클라이언트와의 상호작용** 없음(관리자 전용 테이블, [04-templates.md](04-templates.md) 참고).

**오류·예외**
| 상황 | 결과 |
|---|---|
| 라우트의 `[category]` 가 6종이 아님 | `notFound()` → 404 |
| 길이 초과 | 해당 필드 오류(위 표의 문구) |
| 본문을 넣었는데 정제 후 빈 문자열 | 필드 오류 `body` "저장할 수 있는 본문이 없습니다." (**입력 자체가 비어 있었다면 오류가 아니다** — `body === '' && parsed.data.body !== ''` 조건) |
| 저장 실패 | 폼 배너 "템플릿을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." + `console.error('[news-templates] …')` |
| 복원 실패 | 다이얼로그 배너 "기본값으로 되돌리지 못했습니다. 잠시 후 다시 시도해 주세요." |
| 카테고리가 `board_categories` 에서 사라짐 | FK `news_category_templates_category_fkey` 가 `on delete cascade` 라 템플릿 행도 함께 사라진다. 화면은 코드 시드로 열리고, 저장하면 FK 위반으로 실패한다 |
| 동시 편집 | 잠금·버전 검사가 없다. 나중에 저장한 쪽이 이긴다 |
