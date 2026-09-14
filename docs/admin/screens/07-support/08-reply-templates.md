# 답변 템플릿 (`/inquiries/reply-templates`)

> 07 고객지원 › 분류 관리. 등록·수정 다이얼로그는 [09-reply-template-form.md](09-reply-template-form.md). 세 갈래 템플릿(문의 카테고리 프리필 · 뉴스 카테고리 템플릿 · 답변 템플릿)의 비교는 `docs/admin/TEMPLATES-GUIDE.md`.

**목적** 문의 답변을 쓸 때 불러다 쓰는 상용구를 관리한다. 공통 문안은 모든 문의에서, 카테고리 문안은 그 분류의 문의에서만 선택지에 뜬다.

**데이터 출처**
- 페이지: `admin/app/(admin)/inquiries/reply-templates/page.tsx`, `dynamic = 'force-dynamic'`(저장 직후의 화면이 곧 답변 화면의 선택지다).
- 가드: `requirePermission('inquiries','read')` + write 판정.
- 조회: `getInquiryReplyTemplates()` — `inquiry_reply_templates` 전체를 `sort_order asc, created_at asc` 로 읽고, `getInquiryReplyTemplateCategories()` 로 카테고리 목록을 받아 묶음을 만든다.
- 묶음 순서: **공통이 맨 위**(`category_id IS NULL`), 그다음 카테고리를 **종류 → 그 안의 `sort_order`** 로 늘어놓는다. SQL 로 `kind` 를 정렬하면 알파벳순(bug · inquiry · report)이 되어 고객지원 메뉴와 어긋나므로, 순번은 `INQUIRY_KIND_VALUES` 의 자리로 매긴다.
- RLS: `inquiry_reply_templates_admin_all` — **관리자 전용 테이블**이다. 사용자 사이트는 읽지 않는다.
- 조회 실패: `hasError` → 상단 `LIST_LOAD_ERROR` 배너.

## 1. 페이지 헤더

| 필드/컨트롤 | 종류 | 필수·제한 | 기본값 | 동작 / 상호작용 |
|---|---|---|---|---|
| 제목 | 텍스트 | — | "답변 템플릿" | — |
| 설명 | 텍스트 | — | "홈페이지 문의 답변에 불러다 쓰는 상용구입니다. 공통 템플릿은 모든 문의에서, 카테고리 템플릿은 그 분류의 문의에서만 보입니다. 자리표시자({{닉네임}} 등)는 불러오는 순간 그 문의의 정보로 바뀝니다." | — |
| 문의 카테고리 | 버튼(ghost) | — | — | `/inquiries/categories` 로 이동 |
| 템플릿 등록 | 버튼(primary) | write 권한 | 카테고리 기본값 = 공통 | 다이얼로그 |

## 2. 묶음 카드 (`InquiryReplyTemplateGroup`)

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값 | 동작 / 상호작용 |
|---|---|---|---|---|
| 묶음 제목 | 텍스트 | — | 공통 묶음은 `공통(모든 카테고리) ({n})`, 나머지는 `{종류} · {라벨} ({n})`(예: `버그제보 · 접속·서버 (3)`) | 라벨만 적으면 세 창구의 분류가 섞인 화면에서 "이 문안이 어디에서 보이는가"를 알 수 없다 |
| 숨긴 카테고리 뱃지 | `Badge neutral` | 그 카테고리가 비활성일 때만 | — | "왜 답변 화면에 안 보이나"를 설명한다 |
| 순서 저장 | 버튼(secondary, sm) + 폼 | write **AND 항목이 2개 이상**일 때만 렌더. 순서가 바뀐 경우에만 활성 | "순서 저장" / "저장 중…" | hidden `ids`(콤마 연결). `reorderInquiryReplyTemplatesAction` → 그 묶음 안 `sort_order` 를 0..n-1 로 다시 쓴다 → 감사 `inquiry_reply_template.reorder`(`after: { ids }`) → 토스트 "순서를 저장했습니다." |
| 템플릿 추가 | 버튼(secondary, sm) | write | **그 묶음의 `categoryId`** 가 기본 선택 | 다이얼로그 |
| 빈 묶음 | 안내문 | — | — | "등록된 템플릿이 없습니다. 이 분류의 문의에서는 공통 템플릿만 보입니다." |

- 템플릿이 없는 카테고리도 **자리를 남긴다** — 어디에 넣는지가 보여야 한다.
- 화면 상태는 **순서(id 나열)뿐**이다(카테고리 화면과 같은 규격). 항목의 내용·사용 여부는 매번 서버 배열에서 읽는다.
- 정렬 스키마는 `ids` 만 받는다(`inquiryReplyTemplateReorderSchema`). 카테고리 화면과 달리 kind 를 함께 싣지 않는다.

## 3. 템플릿 행 (`InquiryReplyTemplateRow`)

| 열/요소 | 값의 출처 | 표시 규칙 |
|---|---|---|
| ▲ / ▼ | 클라이언트 순서 상태 | write 일 때만. `aria-label="{이름} 위로/아래로"`. 끝에서는 비활성. **누르면 저장되지 않는다** |
| 이름 | `name` | 굵게 |
| 본문 요약 | `body` | 줄바꿈을 ` · ` 로 접어 최대 두 줄(`line-clamp-2`) |
| 사용 여부 | `is_active` | `Badge success` "사용" / `Badge neutral` "중지" |
| 끄기·켜기 | 버튼(ghost, sm) + 폼 | hidden `templateId`, `isActive`(반대값). `toggleInquiryReplyTemplateAction` → `is_active` + `updated_by` → 감사 `inquiry_reply_template.update` → 토스트 "템플릿을 켰습니다." / "템플릿을 껐습니다." |
| 수정 | 버튼(secondary, sm) | 다이얼로그(프리필된 값) |
| 삭제 | 버튼(danger, sm) | 확인 다이얼로그(§3.1) |

### 3.1 삭제 확인 (`InquiryReplyTemplateDeleteButton`)

| 요소 | 값 |
|---|---|
| 제목 | 답변 템플릿 삭제 |
| 설명 | "되돌릴 수 없습니다. 이미 등록된 답변은 그대로 남고, 앞으로 이 문안을 불러올 수 없게 됩니다. 잠시 쓰지 않으려는 것이라면 삭제 대신 '끄기'를 쓰세요." |
| 본문 | 템플릿 이름 |
| 버튼 | "취소" · "삭제"(danger, 진행 중 "삭제 중…") |

**사용 건수를 확인하지 않는다.** 카테고리(06)와 다른 점이다 — 템플릿은 답변을 만들 때 내용이 **복사**되는 문안이라, 지워도 이미 등록된 답변은 그대로 남는다.

## 4. 서버 액션 요약

`admin/lib/actions/inquiry-reply-template-actions.ts` · 공통 문구·무효화는 `inquiry-reply-template-shared.ts`.

| 동작 | 액션 | 검증 | DB | 감사 | 재검증 |
|---|---|---|---|---|---|
| 등록 | `createInquiryReplyTemplateAction` | `inquiryReplyTemplateSchema` | insert(`sort_order = getNextInquiryReplyTemplateSortOrder(categoryId)`, `created_by`·`updated_by` = 나) | `inquiry_reply_template.create` | `revalidatePath('/inquiries/reply-templates')` |
| 수정 | `updateInquiryReplyTemplateAction` | 동일 | update. **카테고리를 옮기면 새 묶음의 맨 뒤로 `sort_order` 를 다시 잡는다**(그대로 두면 순번이 겹쳐 화면 순서가 갈린다) | `.update`(before/after) | 동일 |
| 삭제 | `deleteInquiryReplyTemplateAction` | `templateId` 존재 | delete | `.delete`(before) | 동일 |
| 사용 토글 | `toggleInquiryReplyTemplateAction` | `templateId` 존재 | `is_active`, `updated_by` | `.update` | 동일 |
| 순서 저장 | `reorderInquiryReplyTemplatesAction` | `ids` uuid 1개 이상 | 행마다 `sort_order = index`, `updated_by` | `.reorder` | 동일 |

**`revalidateClient()` 는 호출하지 않는다.** 사용자 사이트가 읽지 않는 테이블이라 태울 태그가 없다. 문의 상세의 "템플릿 불러오기" 선택지는 그 화면이 `force-dynamic` 이라 요청마다 다시 읽는다.

## 5. 상태·뱃지 의미

| 뱃지 | 값 | 의미 |
|---|---|---|
| 사용(success) | `is_active = true` | 답변 화면의 선택 상자에 뜬다 |
| 중지(neutral) | `is_active = false` | 선택 상자에서 즉시 사라진다. 행과 문안은 그대로 남는다 |
| 숨긴 카테고리(neutral, 묶음 머리) | 그 `inquiry_categories.is_active = false` | 템플릿이 '사용'이어도 그 카테고리로 접수되는 새 문의가 없다는 뜻 |

## 6. 클라이언트와의 상호작용

- **사용자 사이트는 이 테이블을 읽지 않는다.** RLS 가 관리자 전용이고, 캐시 태그도 없다.
- 유일한 소비처는 문의 상세의 답변 폼이다. `getInquiryReplyTemplateOptions(categoryLabel)` 이 다음 규칙으로 선택지를 만든다:
  1. `inquiry_categories` 에서 **라벨로** 카테고리를 찾는다(`inquiries.category` 가 라벨 문자열이다).
  2. 찾으면 `category_id is null OR category_id = {id}`, 못 찾으면 **공통만**.
  3. `is_active = true` 인 것만.
  4. 공통을 앞에 두고 각 묶음 안에서 `sort_order` 순으로 정렬한다.
- 옛 라벨('계정' 등)이나 이메일 문의(`category='email'`)는 매칭되는 카테고리가 없어 **공통 템플릿만** 남는다. 그래도 불러오기 컨트롤을 감추지 않는다.
- 문안의 최종 소비자는 사용자다 — 불러오면 자리표시자가 치환되고, 등록하면 그대로 `/support/inquiries/[id]` 답변 스레드(또는 답신 메일)에 나간다([04-reply-form.md](04-reply-form.md) §3).
- 마이그레이션 `20260914000400` §8 이 "추가 정보 요청" · "제보 증거 자료 요청" · "오류 재현 정보 요청" · "서버 점검 안내" 시드 템플릿의 꼬리 문구를 **"이 문의에 답장으로 남겨 주세요. 문의가 처리 중 상태인 동안 답장할 수 있습니다."** 로 되돌렸다(20260914000300 의 "새 문의로 접수해 주세요"를 뒤집은 것). 완료 계열(처리 완료 안내 · 아이템 지급 처리 완료 · 데이터 복구 안내)은 그대로 둔다 — 그 답변은 상태를 '답변 완료'로 닫으면서 나가 답장 창이 없다. **다만 회원 답장 UI 는 아직 없다**(README §2.7) — 문구가 앞서 있는 상태다.

## 7. 오류·예외

| 상황 | 결과 |
|---|---|
| 목록 조회 실패 | `hasError` → `LIST_LOAD_ERROR` 배너 |
| 카테고리 조회 실패 | 콘솔 경고 + 빈 목록 → 공통 묶음만 그려진다 |
| 이름 중복 (23505) | 필드 오류 `name`: "같은 카테고리에 같은 이름의 템플릿이 있습니다." — 유니크 인덱스가 `coalesce(category_id, '00000000-…')` + `name` 이라 **공통끼리도** 이름이 겹칠 수 없다 |
| 고른 카테고리가 그 사이 삭제됨 (23503) | 필드 오류 `categoryId`: "고른 카테고리가 사라졌습니다. 목록을 새로고침한 뒤 다시 시도해 주세요." |
| 대상 행 없음 | "템플릿을 찾을 수 없습니다." |
| 순서 저장 일부 실패 | "순서를 저장하지 못했습니다. 일부만 반영됐을 수 있으니 새로고침해 순서를 확인해 주세요." |
| 정렬 페이로드가 깨짐 | "정렬 정보를 읽지 못했습니다." |
| 그 밖 저장·삭제 실패 | "템플릿을 등록/수정/삭제하지 못했습니다. …" (등록·수정은 "잠시 후 다시 시도해 주세요.", 삭제는 "목록을 새로고침한 뒤 다시 시도해 주세요.") |
| 읽기 전용 관리자 | ▲▼·순서 저장·추가·토글·수정·삭제가 렌더되지 않는다. 등록 버튼도 헤더에서 빠진다 |
