# FAQ (`/faqs`)

> 07 고객지원 › FAQ 목록. 등록·수정 다이얼로그와 삭제 확인은 [11-faq-form.md](11-faq-form.md).
> **권한 모듈이 다르다** — 문의 계열은 `inquiries`, 이 화면만 `faqs` 다.

**목적** 사용자 사이트 `/support/faq` 의 "자주 묻는 질문"에 노출할 항목을 카테고리별로 관리한다(등록·문구·순서·발행).

**데이터 출처**
- 페이지: `admin/app/(admin)/faqs/page.tsx`, `dynamic = 'force-dynamic'`(발행 토글·정렬 저장 직후의 화면이 곧 사용자 사이트의 상태다).
- 가드: `requirePermission('faqs','read')` + `hasPermission(..., 'faqs', 'write')`.
- 조회: `getFaqGroups()`(`admin/lib/data/faqs.ts`) — `faqs` 전체를 `sort_order asc, created_at asc` 로 한 번 읽고 `FAQ_CATEGORIES` 순서로 5묶음으로 나눈다. **비어 있는 카테고리도 그린다**(첫 항목을 여기서 추가한다).
- RLS: 공개 정책 `faqs_select_published` 는 발행분만 열고, 미발행까지 보이는 근거는 `faqs_admin_all` 이다.
- 조회 실패: 예외를 던지지 않고 **5개 빈 묶음**을 돌려준다(`console.error('[faqs] 목록 조회 실패')`). 이 화면에는 `LIST_LOAD_ERROR` 배너가 **없다** — 실패와 "항목 없음"이 화면에서 구분되지 않는다.

## 1. 페이지 헤더

| 필드/컨트롤 | 종류 | 필수·제한 | 기본값 | 동작 / 상호작용 |
|---|---|---|---|---|
| 제목 | 텍스트 | — | "FAQ" | — |
| 설명 | 텍스트 | — | "카테고리 안에서 ▲▼ 로 순서를 바꾸고 '순서 저장'을 눌러 확정합니다. 미발행 항목은 사용자 사이트에 보이지 않습니다." | — |
| FAQ 등록 | 버튼(primary) | write 권한 | 카테고리 = 첫 값(`notice`) | 다이얼로그([11-faq-form.md](11-faq-form.md)) |

## 2. 카테고리 섹션 (`FaqCategorySection`, 5개)

| 카테고리 값 | 라벨 |
|---|---|
| `notice` | 공지사항 |
| `account` | 계정 |
| `payment` | 결제 |
| `bug` | 버그 |
| `etc` | 기타 |

`faq_category` enum 과 1:1 이고, **카테고리가 나열되는 순서 자체는 코드 상수**(`FAQ_CATEGORY_VALUES`)가 소유한다. DB `sort_order` 는 카테고리 **안**의 순서만 정한다. 사용자 사이트(`lib/constants/support.ts`)의 목록과 값·라벨·순서가 같아야 한다.

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값 | 동작 / 상호작용 |
|---|---|---|---|---|
| 섹션 제목 | 텍스트 | — | `{라벨} ({항목 수})` | — |
| 순서 저장 | 버튼(secondary, sm) + 폼 | write. 순서가 실제로 바뀐 경우에만 활성(`hasFaqOrderChanged`) | "순서 저장" / "저장 중…" | hidden `category` + hidden `ids`(콤마 연결). `reorderFaqsAction` → `sort_order` 를 0..n-1 로 다시 쓴다 → 감사 `faq.reorder`(`after: { category, ids }`) → `faqs` 태그 재검증 → 토스트 "순서를 저장했습니다." |
| 추가 | 버튼(secondary, sm) | write | **그 섹션의 카테고리**가 기본 선택 | 다이얼로그 |
| 빈 섹션 | 안내문 | — | — | "등록된 항목이 없습니다." |

정렬 UPDATE 는 `.eq('id', id).eq('category', category)` 로 **두 조건**을 건다 — 다른 카테고리의 id 를 섞어 보내도 그 행의 순번이 바뀌지 않는다(문의 카테고리 정렬에는 없는 안전장치다).

## 3. FAQ 행 (`FaqRow`)

| 열/요소 | 값의 출처 | 표시 규칙 |
|---|---|---|
| ▲ / ▼ | 클라이언트 순서 상태 | write 일 때만. `aria-label="{질문} 위로/아래로"`. 끝에서는 비활성. **누르면 저장되지 않는다** — "순서 저장"으로 확정 |
| 질문 | `question` | 굵게, 한 줄 말줄임 |
| 답변 요약 | `answer` | 흐린 글자, 한 줄 말줄임 |
| 발행 여부 | `is_published` | `Badge success` "발행" / `Badge neutral` "미발행" |
| 숨기기·발행 | 버튼(ghost, sm) + 폼 | hidden `faqId`, `isPublished`(반대값 문자열). `toggleFaqPublishAction` → 감사 `faq.publish` → 태그 재검증 → 토스트 "FAQ를 발행했습니다." / "FAQ를 숨겼습니다." |
| 수정 | 버튼(secondary, sm) | 다이얼로그(프리필된 값) |
| 삭제 | 버튼(danger, sm) | 확인 다이얼로그([11-faq-form.md](11-faq-form.md) §3) |

화면 상태는 **순서(id 나열)뿐**이다. 항목의 내용·발행 여부는 매번 서버가 준 `group.items` 에서 읽는다 — 항목을 상태로 복사하면 토글·수정 뒤 서버가 새 값을 보내도 화면이 예전 값을 계속 그린다(실제로 겪은 버그).

## 4. 서버 액션 요약

`admin/lib/actions/faqs-actions.ts`. 전부 `requirePermission('faqs','write')` 로 시작한다.

| 동작 | 액션 | 검증 | DB | 감사 | 재검증 |
|---|---|---|---|---|---|
| 등록 | `createFaqAction` | `faqSchema` | insert, `sort_order = getNextFaqSortOrder(category)`(그 카테고리 최대+1) | `faq.create`(`after: { category, question, is_published, sort_order }` — **답변 본문은 넣지 않는다**) | `revalidatePath('/faqs')` + `revalidateClient(['faqs'])` |
| 수정 | `updateFaqAction` | `faqSchema` + `faqId` 존재 | update. **카테고리를 옮기면** 새 카테고리 맨 뒤로 `sort_order` 재계산 | `faq.update`(before/after, 답변 포함) | 동일 |
| 삭제 | `deleteFaqAction` | `faqId` 존재 | delete. **남은 항목의 순번은 다시 매기지 않는다**(구멍 0,1,3 이 있어도 표시 순서는 같고 다음 정렬 저장이 정리한다) | `faq.delete`(before 전체) | 동일 |
| 발행 토글 | `toggleFaqPublishAction` | `faqId` 존재 | `is_published` | `faq.publish` | 동일 |
| 순서 저장 | `reorderFaqsAction` | `faqReorderSchema`(category enum + uuid 1개 이상) | 행마다 `sort_order = index` (category 조건 동반) | `faq.reorder` | 동일 |

## 5. 상태·뱃지 의미

| 뱃지 | 값 | 의미 |
|---|---|---|
| 발행(success) | `is_published = true` | 사용자 사이트 `/support/faq` 아코디언에 나온다 |
| 미발행(neutral) | `is_published = false` | `faqs_select_published` RLS 로 사용자 쪽에서 **즉시 사라진다**(캐시 만료를 기다릴 것도 없이 행 자체가 조회되지 않는다) |

## 6. 클라이언트와의 상호작용

- 사용자 사이트 `/support/faq`(`app/(public)/support/faq/page.tsx`)가 `getFaqGroups()`(클라이언트 쪽 `lib/data/faqs.ts`)로 읽고, `unstable_cache` 태그 `faqs`(300초)에 담는다.
- 관리자의 모든 쓰기가 `revalidateClient([CLIENT_CACHE_TAGS.faqs])` 로 즉시 반영을 시도한다. 실패해도 최대 300초 뒤 자동 반영된다.
- 표시 형태: `components/support/FaqAccordion` 이 `details/summary` 로 그린다(자바스크립트 없이 열고 닫힌다). 요약 줄 = 카테고리 칩 + 질문, 펼친 내용 = 답변 한 문단.
- **답변의 줄바꿈은 사용자 화면에서 유지된다** — 아코디언의 답변 문단이 `whitespace-pre-line` 으로 그려진다. 다만 관리자 폼의 hint 와 미리보기는 아직 "한 문단으로 이어 붙인다(줄바꿈 표시 없음)"를 전제로 한다([11-faq-form.md](11-faq-form.md) §4 참고).
- 마크다운·HTML 은 어느 쪽에서도 해석되지 않는다(원문 기호가 그대로 노출된다).
- 카테고리 칩 문구는 양쪽 상수가 같은 라벨을 쓴다.

## 7. 오류·예외

| 상황 | 결과 |
|---|---|
| 목록 조회 실패 | 5개 빈 섹션 + 콘솔 오류. **화면에 배너가 없어** "항목 없음"과 구분되지 않는다 |
| `faqId` 가 빈 값 | "대상을 찾을 수 없습니다." |
| 대상 행 없음 | "FAQ를 찾을 수 없습니다." |
| 등록·수정 실패 | "FAQ를 등록/수정하지 못했습니다. 잠시 후 다시 시도해 주세요." |
| 삭제 실패 | "FAQ를 삭제하지 못했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요." |
| 발행 토글 실패 | "FAQ 발행 상태를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요." |
| 순서 저장 일부 실패 | "순서를 저장하지 못했습니다. 일부만 반영됐을 수 있으니 새로고침해 순서를 확인해 주세요." |
| 정렬 페이로드가 깨짐 / 카테고리가 enum 밖 | "정렬 정보를 읽지 못했습니다." |
| 사용자 사이트 재검증 실패 | 저장은 성공한다. 경고 로그만 남고 최대 300초 뒤 자동 반영 |
| 읽기 전용 관리자(`faqs:read`) | ▲▼·순서 저장·추가·발행 토글·수정·삭제와 헤더의 등록 버튼이 전부 렌더되지 않는다(미발행 항목 열람은 가능) |
