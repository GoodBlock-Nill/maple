# 고객지원 — 문의 카테고리 · 답변 템플릿

> `07-support.md` 의 연속 문서(길이 상한으로 분리). 관리자 콘솔(`admin/`)의 고객지원 메뉴 중 분류 체계를 관리하는 두 화면을 정리한다.
> 작성 규칙: 코드에서 확인한 사실만 쓴다. 파일 경로는 저장소 루트 기준. 워딩은 "카테고리"(말머리 금지).
> 심화 문서: `docs/admin/INQUIRY-GUIDE.md`, 템플릿 세 갈래(문의 카테고리 프리필 · 뉴스 카테고리 템플릿 · 답변 템플릿) 비교는 `docs/admin/TEMPLATES-GUIDE.md`.

## 0. 한눈에

| 항목 | 값 |
|---|---|
| 경로 | `/inquiries/categories`, `/inquiries/reply-templates` |
| 권한 모듈 | `inquiries` — read / write (`admin/lib/auth/permissions.ts`) |
| 주요 테이블 | `inquiry_categories`, `inquiry_reply_templates` |
| 클라이언트 영향 | 카테고리: 태그 `inquiry-categories` 재검증 → 사용자 문의 폼 즉시 반영. 답변 템플릿: 없음(관리자 전용 테이블) |
| 관련 파일 | `admin/app/(admin)/inquiries/{categories,reply-templates}/page.tsx`, `admin/components/{inquiry-categories,inquiry-reply-templates}/*`, `admin/lib/{actions,data,validation}/inquiry-categor*.ts`, `admin/lib/{actions,data,validation}/inquiry-reply-template*.ts` |

## 1. 문의 카테고리 (`/inquiries/categories`)

**목적** 세 접수 창구(1:1 문의 · 버그제보 · 불법이용제보)의 카테고리, 프리필(문의 내용 양식), 세부 유형, 노출 순서·여부를 관리한다.

**화면 구성**
- 종류(kind)별 3개 섹션(1:1 문의 / 버그제보 / 불법이용제보). 비어 있는 창구도 섹션 자리를 남긴다.
- 섹션 안에서 ▲▼ 로 순서를 옮기고 그 섹션의 "순서 저장"을 눌러 확정(섹션마다 독립된 버튼).
- 행: 이름, 설명, 세부 유형 목록, 노출 여부, 사용 건수(그 라벨로 접수된 문의 수).
- "카테고리 등록"/"카테고리 추가"(섹션별, 그 섹션의 종류가 기본값) 다이얼로그: 이름(≤20자), 종류 select, 설명(≤100자), 프리필(≤2000자, 평문 textarea + 미리보기), 세부 유형 편집기(항목마다 ≤30자, 최대 20개, 중복 불가), "노출" 체크박스.

**동작(서버 액션)**

| 동작 | 액션 함수 | 검증 | DB 변경 | 감사 로그 | 클라이언트 영향 |
|---|---|---|---|---|---|
| 등록 | `createInquiryCategoryAction` (`admin/lib/actions/inquiry-category-actions.ts`) | zod `inquiryCategorySchema` | `inquiry_categories` insert(그 kind 맨 뒤 `sort_order`, key는 라벨에서 자동 생성) | `inquiry_category.create` | 태그 `inquiry-categories` |
| 수정 | `updateInquiryCategoryAction` (같은 파일) | zod `inquiryCategorySchema` | RPC `update_inquiry_category()`(9인자: `p_id,p_key,p_label,p_description,p_prefill,p_sort_order,p_is_active,p_subtypes,p_kind`) — 카테고리 행 갱신 + 라벨·종류가 바뀐 만큼 과거 `inquiries.category`/`inquiries.kind` 재라벨링을 **한 트랜잭션**에서 처리 | `inquiry_category.update`(옮긴 문의 수를 `relabelled_inquiries` 로 기록) | 태그 `inquiry-categories` |
| 삭제 | `deleteInquiryCategoryAction` | - | `inquiry_categories` delete(사용 건수 0건일 때만) | `inquiry_category.delete` | 태그 `inquiry-categories` |
| 활성/비활성 토글 | `toggleInquiryCategoryAction` (`inquiry-category-order-actions.ts`) | - | `inquiry_categories.is_active` | `inquiry_category.update` | 태그 `inquiry-categories` |
| 순서 저장 | `reorderInquiryCategoriesAction` (같은 파일) | zod `inquiryCategoryReorderSchema`(ids + kind) | `inquiry_categories.sort_order`(그 kind 안 0..n-1) | `inquiry_category.reorder` | 태그 `inquiry-categories` |

**클라이언트와의 상호작용**
- 사용자 사이트 문의 폼(`/support`, `/support/bug`, `/support/report`)의 카테고리 선택 상자·프리필·세부 유형 선택 상자는 이 테이블을 `unstable_cache`(300초)로 읽는다. 모든 쓰기 액션이 `revalidateClient([CLIENT_CACHE_TAGS.inquiryCategories])` 를 호출해 즉시 반영을 시도하고, 실패해도 최대 5분 뒤 자동 반영된다.
- **라벨(이름) 변경**은 `update_inquiry_category()` RPC가 그 라벨로 이미 접수된 과거 문의의 `category` 를 새 이름으로 함께 옮긴다 — 이름만 바꾸고 과거 문의를 두면 목록 필터에서 사라지기 때문에, 저장이 실패 없이 한 번에 끝나거나 함께 실패한다.
- **종류(kind) 변경**도 같은 RPC가 같은 트랜잭션에서 그 카테고리로 접수된 과거 `inquiries.kind` 까지 옮긴다. 접수된 문의가 있는 카테고리의 종류를 바꿀 때는 화면에서 확인 한 단계를 더 거친다(0건이면 확인 없이 저장).
- `07-support.md` §1의 카테고리·유형 필터 옵션도 이 테이블(+ 데이터에만 남은 옛 라벨, `inquiry_category_usage()` RPC 집계)로 구성된다.

**주의**
- `sort_order` 는 **kind 안에서의 순서**다(2026-09-14 마이그레이션). 정렬 저장은 한 종류의 id만 모아 보내야 하며, 세 섹션 것을 섞어 보내면 서로의 순번을 덮어쓴다.
- 삭제는 사용 건수(그 라벨로 접수된 문의) 0건일 때만 가능하다. 있으면 비활성화를 권장하며, 화면·액션·DB(FK) 세 겹이 같은 규칙을 강제한다.
- `key`(안정 식별자)는 등록 시 라벨에서 자동 생성되고, 이후 라벨이 바뀌어도 그대로 유지된다.
- 워딩은 "카테고리"다. 이 화면·문서 어디에도 "말머리"라는 표현을 쓰지 않는다.

## 2. 답변 템플릿 (`/inquiries/reply-templates`)

**목적** 문의 답변을 작성할 때 불러다 쓰는 상용구(공통 또는 카테고리 전용)를 관리한다.

**화면 구성**
- 공통 묶음(맨 위, `category_id IS NULL`) + 카테고리별 묶음(접수 창구 순서 → 그 안의 `sort_order`, 머리글은 `종류 · 라벨` 예: "버그제보 · 접속·서버").
- 묶음 안에서 ▲▼ 순서 이동 + "순서 저장"(묶음별 독립 버튼).
- "템플릿 등록"/"템플릿 추가": 카테고리 select(첫 항목이 "공통(모든 카테고리)", 비활성 카테고리도 선택 가능 — 이미 붙은 템플릿을 고칠 수 있어야 하므로), 템플릿 이름(≤40자), 본문(≤2000자, 평문 + 미리보기 + 자리표시자 안내), "답변 화면에서 사용" 체크박스.

**동작(서버 액션)**

| 동작 | 액션 함수 | 검증 | DB 변경 | 감사 로그 | 클라이언트 영향 |
|---|---|---|---|---|---|
| 등록 | `createInquiryReplyTemplateAction` (`admin/lib/actions/inquiry-reply-template-actions.ts`) | zod `inquiryReplyTemplateSchema` | `inquiry_reply_templates` insert(그 묶음 맨 뒤 순번) | `inquiry_reply_template.create` | 없음(관리자 전용 테이블, `revalidatePath` 만) |
| 수정 | `updateInquiryReplyTemplateAction` | 동일 스키마 | `inquiry_reply_templates` update(카테고리를 옮기면 새 묶음 맨 뒤로 순번 재계산) | `inquiry_reply_template.update` | 없음 |
| 삭제 | `deleteInquiryReplyTemplateAction` | - | `inquiry_reply_templates` delete(**사용 건수 제한 없음**) | `inquiry_reply_template.delete` | 없음 |
| 사용/숨김 토글 | `toggleInquiryReplyTemplateAction` | - | `inquiry_reply_templates.is_active` | `inquiry_reply_template.update` | 없음 |
| 순서 저장 | `reorderInquiryReplyTemplatesAction` | zod `inquiryReplyTemplateReorderSchema`(ids) | `inquiry_reply_templates.sort_order`(그 묶음 안 0..n-1) | `inquiry_reply_template.reorder` | 없음 |

**클라이언트와의 상호작용**
- 사용자 사이트는 이 테이블을 **읽지 않는다**(`inquiry_reply_templates_admin_all` RLS가 관리자 전용). 저장은 `/inquiries/reply-templates` 경로만 `revalidatePath` 하고 `revalidateClient()` 는 호출하지 않는다.
- 문의 상세(`/inquiries/[id]`, `07-support.md` §3) 답변 폼의 "템플릿 불러오기" 선택지는 공통 + 그 문의 카테고리에 속한 **활성** 템플릿만 노출된다(`getInquiryReplyTemplateOptions`, 카테고리를 라벨로 매칭).
- 자리표시자 4종(`{{닉네임}}` `{{문의번호}}` `{{카테고리}}` `{{제목}}`)은 문의 상세에서 "불러오기"를 누르는 순간 그 문의의 실제 값으로 치환된다(값이 비어 있으면 "고객"/"-"/"문의" 같은 대체 문구). 저장되는 답변에는 원본 토큰이 남지 않는다 — 남으면 사용자 화면에 `{{닉네임}}` 이 그대로 노출되기 때문.

**주의**
- 템플릿 본문 상한(2000자)은 답변 입력 상한과 **같다** — 불러왔는데 등록할 수 없는 템플릿이 만들어지지 않도록.
- 같은 묶음(카테고리 또는 공통) 안에서 이름이 중복되면 23505 → "같은 카테고리에 같은 이름의 템플릿이 있습니다" 필드 에러.
- 그 사이 카테고리가 삭제됐다면 23503 → "고른 카테고리가 사라졌습니다" 필드 에러.
- 삭제는 카테고리(§1)와 달리 **사용 건수를 확인하지 않는다** — 템플릿은 답변을 만들 때 내용이 복사되는 문안이라, 지워도 이미 등록된 답변은 그대로 남기 때문이다.
- 세 갈래 템플릿(문의 카테고리 프리필 · 뉴스 카테고리 템플릿 · 답변 템플릿)의 채우는 화면·읽는 사람·무효화 경로·자리표시자 처리 차이는 `docs/admin/TEMPLATES-GUIDE.md` 의 비교표를 참고한다(이 문서에서 중복 서술하지 않는다).
