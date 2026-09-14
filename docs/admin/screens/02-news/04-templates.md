# 카테고리 템플릿 목록 (`/news/templates`)

**목적** 카테고리 6종별 글 양식(제목·요약·본문 템플릿)을 한눈에 보고 편집 화면으로 들어간다. 새 글 작성 화면에서 카테고리를 고르면 여기 저장된 양식이 폼을 채운다.

**데이터 출처**
- 진입 가드 `requirePermission('news', 'write')` — **읽기 전용 관리자에게는 메뉴 자체가 보이지 않는다**(`admin/lib/nav.ts` 의 하위 항목 `level: 'write'`). 편집·되돌리기 말고는 볼 것이 없는 화면이라서다.
- `listNewsTemplates()` (`admin/lib/data/news-templates.ts`) — 세션 클라이언트로 `news_category_templates` 전체를 읽고, `NEWS_CATEGORY_KEYS` 순서로 6행을 만든다. **DB 에 행이 없는 카테고리는 코드 시드(`NEWS_TEMPLATE_SEEDS`)로 채워 보여 준다**(`id: null`, `updatedAt: null`, `isDefault: true`, `isActive: true`) — 행이 없다고 카드가 사라지면 운영자가 그 카테고리에 템플릿을 만들 입구를 잃는다.
- `export const dynamic = 'force-dynamic'` — 저장 직후의 화면이 곧 새 글 폼이 쓰는 양식이다.
- 조회 실패 시: `{ rows: [], hasError: true }` → 목록 위에 `FormBanner`(`LIST_LOAD_ERROR`)가 뜨고 **목록은 빈 채로 남는다**. 여기서 코드 기본값을 대신 그리면 운영자가 저장된 문안을 보고 있다고 믿고, 그 화면에서 고친 값이 남의 문안을 덮어쓴다.

## 1.1 헤더
| 필드/컨트롤 | 종류 | 동작 / 문구 |
|---|---|---|
| 제목 | `PageHeader` | "카테고리 템플릿 관리" |
| 설명 | 텍스트 | "카테고리별 글 양식입니다. 새 글 작성 화면에서 카테고리를 고르면 제목·요약·본문이 이 양식으로 채워집니다. {{날짜}} 같은 자리는 자동으로 바뀌지 않으니 작성할 때 직접 고쳐 주세요." |
| 뉴스 목록 | 링크 버튼(secondary) | `/news` |

## 1.2 목록 (`NewsTemplateList`)
`Card` + `CardHeader`(제목 `카테고리 템플릿 (6)`, 설명 "새 글 작성 화면에서 카테고리를 고르면 이 양식이 제목·요약·본문을 채웁니다."). 한 줄에 카테고리 하나(`<li data-testid="news-template-{categoryKey}">`).

| 필드/컨트롤 | 종류 | 값의 출처 | 표시 규칙 | 동작 |
|---|---|---|---|---|
| 카테고리 뱃지 | `Badge`(폭 92px 고정) | `label` / `tone` | 폭을 고정해 줄마다 제목 시작 위치가 흔들리지 않게 한다 | — |
| 제목 템플릿 | 한 줄(`line-clamp-1`, bold) | `title_template` | 비어 있으면 `제목 템플릿 없음` | — |
| 본문 발췌 | 한 줄(muted, `line-clamp-1`) | `body_template` | `postHtmlText()` 로 태그를 벗기고 공백을 접은 평문. 비어 있으면 `본문 템플릿 없음`. 서식까지 보려면 편집 화면의 미리보기를 본다 | — |
| 기본값 / 수정됨 · 최종 수정 | 한 줄(muted) | `isDefault`, `updated_at` | `기본값` 또는 `수정됨` + ` · 저장된 적 없음`(행 없음) 또는 ` · 최종 수정 {YYYY-MM-DD HH:mm}` | — |
| 사용 여부 | `Badge` | `is_active` | `사용`(success) / `사용 안 함`(neutral) | — |
| 수정 | 링크 버튼(secondary sm) | — | 항상 | `/news/templates/{categoryKey}` → [05-templates-edit.md](05-templates-edit.md) |

**`isDefault` 판정** `isSameAsSeed()` — 저장된 `title_template`·`summary_template`·`body_template` **세 값이 모두** 코드 시드와 문자 단위로 같으면 `기본값`. `is_active` 는 비교에 넣지 않는다. 코드 시드(`admin/lib/constants/news-templates.ts`)와 마이그레이션 시드(`20260911000100_news_category_templates.sql`)는 한 생성기(`node scripts/gen-news-templates.mjs`)가 함께 뽑아 글자까지 같다.

**동작(서버 액션)** 이 화면은 조회 전용이다. 저장·되돌리기는 편집 화면에서 한다.

**상태·뱃지 의미**
| 값 | 라벨 | 색 | 언제 |
|---|---|---|---|
| `is_active = true` | 사용 | success | 새 글에서 이 카테고리를 고르면 템플릿이 채워진다 |
| `is_active = false` | 사용 안 함 | neutral | 문안은 남아 있지만 새 글 폼이 아무것도 채우지 않는다(`decideNewsTemplateApply` 가 `none`). 수정 화면의 "템플릿 불러오기" 버튼도 사라진다 |
| `isDefault = true` | 기본값 | neutral(편집 화면 헤더 뱃지) | 문안 셋이 코드 시드와 동일 |
| `isDefault = false` | 수정됨 | accent | 하나라도 다름. 이때만 "기본값으로 되돌리기" 버튼이 보인다 |

**클라이언트와의 상호작용**
- **없음.** `news_category_templates` 는 RLS `news_category_templates_admin_all`(`is_admin()`)로 관리자에게만 열려 있고, anon·일반 로그인 사용자에게는 SELECT 조차 열지 않는다(발행 전 점검 일정·이벤트 보상 초안이 템플릿에 적히는 일이 흔한데 아직 공개된 정보가 아니다).
- 사용자 사이트는 이 테이블을 읽지 않는다. 템플릿이 사용자에게 닿는 유일한 경로는 "운영자가 그 양식으로 글을 써서 발행"하는 것뿐이다.

**오류·예외**
- 조회 실패: 배너 + 빈 목록(위 참고).
- `news:write` 가 없는 관리자가 URL 로 직접 들어오면 `/?error=forbidden`.
- 카테고리가 6종보다 많아져도 이 화면은 `NEWS_CATEGORY_KEYS` 기준으로만 그린다 — 상수에 없는 `category_key` 행은 목록에 나타나지 않는다.
