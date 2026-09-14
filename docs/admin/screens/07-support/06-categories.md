# 문의 카테고리 (`/inquiries/categories`)

> 07 고객지원 › 분류 관리. 등록·수정 다이얼로그는 [07-category-form.md](07-category-form.md).

**목적** 세 접수 창구(1:1 문의 · 버그제보 · 불법이용제보)의 카테고리와 프리필(문의 내용 양식), 세부 유형, 노출 여부, 창구 안에서의 순서를 관리한다. 이 화면의 값이 **그대로 사용자 접수 폼**이 된다.

**데이터 출처**
- 페이지: `admin/app/(admin)/inquiries/categories/page.tsx`, `dynamic = 'force-dynamic'`(저장 직후의 화면이 곧 사용자 폼의 상태다).
- 가드: `requirePermission('inquiries','read')` + `hasPermission(..., 'write')`.
- 조회: `getInquiryCategories()` — `inquiry_categories` 전체를 `sort_order asc, created_at asc` 로 한 번 읽고, 같은 왕복에서 `inquiry_category_usage()` RPC 로 라벨별 접수 건수를 받는다. **질의는 한 번이고 나누는 일은 화면이 한다**(`groupInquiryCategoriesByKind`) — 창구마다 질의하면 집계가 세 번 돌고 세 섹션이 서로 다른 시점을 본다.
- RLS: 공개 정책 `inquiry_categories_select_active` 는 활성 행만 열고, 비활성까지 보이는 근거는 `inquiry_categories_admin_all` 이다.
- 조회 실패: `hasError=true` → 상단 `LIST_LOAD_ERROR` 배너.

## 1. 페이지 헤더

| 필드/컨트롤 | 종류 | 필수·제한 | 기본값 | 동작 / 상호작용 |
|---|---|---|---|---|
| 제목 | 텍스트 | — | "문의 카테고리" | — |
| 설명 | 텍스트 | — | 페이지 설명 문구(아래) | — |
| 답변 템플릿 | 버튼(ghost) | — | — | `/inquiries/reply-templates` 로 이동(아래) |
| 카테고리 등록 | 버튼(primary) | write 권한 | 종류 기본값 `inquiry` | 다이얼로그([07-category-form.md](07-category-form.md)) |

**동작 상세**
- **설명** — "사용자 사이트 고객지원 폼(1:1 문의 · 버그제보 · 불법이용제보)의 카테고리와 프리필(문의 내용 양식)입니다. 순서는 종류 안에서만 매겨집니다 — ▲▼ 로 옮기고 그 종류의 '순서 저장'을 눌러 확정합니다. 숨긴 카테고리는 사용자 폼에서 사라집니다."
- **답변 템플릿** — 카테고리를 고치러 온 운영자가 그 분류의 상용구도 손볼 수 있게.

## 2. 종류 섹션 (`InquiryCategoryList`, 3개)

섹션은 `INQUIRY_KINDS` 순서(1:1 문의 → 버그제보 → 불법이용제보)로 **항상 3개** 그린다. 비어 있는 창구도 자리를 남긴다 — "버그제보 카테고리가 없다"는 사실 자체가 보여야 추가할 곳을 찾는다.

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값 | 동작 / 상호작용 |
|---|---|---|---|---|
| 섹션 제목 | 텍스트 | — | `{종류 라벨} ({항목 수})` | — |
| 순서 저장 | 버튼(secondary, sm) + 폼 | write. **순서가 실제로 바뀌었을 때만** 활성(`hasOrderChanged`) | "순서 저장" / "저장 중…" | `reorderInquiryCategoriesAction` 실행(아래) |
| 카테고리 추가 | 버튼(secondary, sm) | write | **그 섹션의 kind** 가 종류 기본값 | 다이얼로그 |
| 빈 섹션 | 안내문 | — | — | "이 종류에 등록된 카테고리가 없습니다." |

**동작 상세**
- **순서 저장** — hidden `ids`(그 섹션의 id 를 콤마로 이어 붙인 것) + hidden `kind`. `reorderInquiryCategoriesAction` → 그 kind 안에서 `sort_order` 를 0..n-1 로 **다시 쓴다** → 감사 `inquiry_category.reorder`(`after: { kind, ids }`) → 태그 재검증 → 토스트 "순서를 저장했습니다."

- 화면 상태로 들고 있는 것은 **순서(id 나열)뿐**이다. 항목의 내용·활성 여부는 매번 서버 배열에서 읽는다 — 항목 자체를 상태로 복사하면 토글·수정 뒤 화면이 옛 값을 계속 그린다(FAQ 화면에서 실제로 겪은 버그).
- 항목이 늘거나 줄면 부모가 `key` 에 넣은 id 나열이 달라져 섹션이 새로 마운트된다(동기화 이펙트가 필요 없다).
- **정렬 요청에는 한 창구의 id 만 담긴다.** `sort_order` 가 kind 안의 순서라(마이그레이션 20260914000100), 세 섹션을 한 번에 다시 매기면 서로의 순번을 덮어쓴다.

## 3. 카테고리 행 (`InquiryCategoryRow`)

| 열/요소 | 값의 출처 | 표시 규칙 |
|---|---|---|
| ▲ / ▼ | 클라이언트 순서 상태 | 노출·비활성 조건(아래) |
| 이름 | `label` | 굵게 |
| 문의 건수 | `inquiry_category_usage()` 의 라벨별 합계 | 이름 옆 "문의 {n}건". **삭제 가능 여부가 이 값에서 나온다** |
| 설명 | `description` | 한 줄 말줄임. 없으면 "설명 없음" |
| 프리필 요약 | `prefill` | 줄바꿈을 ` · ` 로 접어 한 줄. 비었으면 "프리필 없음" |
| 세부 유형 요약 | `subtypes` | 비었으면 "세부 유형 없음 (기타로 접수)", 있으면 `세부 유형 {n}개 · a · b …` |
| 노출 여부 | `is_active` | `Badge success` "노출" / `Badge neutral` "숨김" |
| 숨기기·노출 | 버튼(ghost, sm) + 폼 | 필드·액션 계약(아래) |
| 수정 | 버튼(secondary, sm) | write. 다이얼로그(프리필된 값) |
| 삭제 | 버튼(danger, sm) | write. 확인 다이얼로그(§3.1) |

**동작 상세**
- **▲ / ▼** — write 일 때만. `aria-label="{라벨} 위로/아래로"`. 첫 행의 ▲, 마지막 행의 ▼ 는 비활성. **누르면 저장되지 않는다** — 여러 번 옮긴 뒤 "순서 저장"으로 확정.
- **숨기기·노출** — write. hidden `categoryId`, `isActive`(반대값 문자열). `toggleInquiryCategoryAction` → 감사 `inquiry_category.update` → 태그 재검증 → 토스트 "카테고리를 활성화/비활성화했습니다."

### 3.1 삭제 확인 (`InquiryCategoryDeleteButton`)

| 요소 | `usageCount === 0` | `usageCount > 0` |
|---|---|---|
| 제목 | 카테고리 삭제 | 카테고리 삭제 |
| 설명 | "되돌릴 수 없습니다. 사용자 폼에서 잠시 감추려는 것이라면 삭제 대신 비활성화하세요." | 삭제 불가 안내(아래) |
| 본문 | `{라벨} · 접수된 문의 {n}건` | 같음 |
| 삭제 버튼 | 활성 | **비활성**(`disabled`) |

- **설명(`usageCount > 0`)** — "이 카테고리로 접수된 문의가 있어 삭제할 수 없습니다. 비활성화하면 사용자 폼에서는 사라지고 기존 문의의 분류는 그대로 남습니다."

`deleteInquiryCategoryAction` 은 버튼이 비활성이어도 **서버에서 다시 센다**(직접 POST 방어): `inquiries` 를 `category = {라벨}` 로 `head: true` 카운트 → 1건 이상이면 `이 카테고리로 접수된 문의가 {n}건 있습니다. 삭제 대신 비활성화해 주세요.` 감사 `inquiry_category.delete`(before 전체).

## 4. 서버 액션 요약

| 동작 | 액션·파일 | 검증 | DB | 감사 | 재검증 |
|---|---|---|---|---|---|
| 등록 | `createInquiryCategoryAction` (`inquiry-category-actions.ts`) | `inquiryCategorySchema` | insert 상세(아래) | `inquiry_category.create` | `revalidateCategories()` |
| 수정 | `updateInquiryCategoryAction` | 동일 | **RPC `update_inquiry_category()` 9인자** — 아래 §5 | `inquiry_category.update`(+`relabelled_inquiries`) | 동일 |
| 삭제 | `deleteInquiryCategoryAction` | `categoryId` 존재 + 사용 0건 | delete | `inquiry_category.delete` | 동일 |
| 노출 토글 | `toggleInquiryCategoryAction` (`inquiry-category-order-actions.ts`) | `categoryId` 존재 | `is_active` | `inquiry_category.update` | 동일 |
| 순서 저장 | `reorderInquiryCategoriesAction` | `inquiryCategoryReorderSchema`(uuid 1개 이상 + kind) | 행마다 `sort_order = index` UPDATE | `inquiry_category.reorder` | 동일 |

`revalidateCategories()` = `revalidatePath('/inquiries/categories')` + `revalidatePath('/inquiries')` + `revalidateClient(['inquiry-categories'])`.

**동작 상세**
- **등록(DB)** — `inquiry_categories` insert. `sort_order = getNextInquiryCategorySortOrder(kind)`(그 창구의 최대+1), `key = toCategoryKey(label)`.

## 5. 라벨·종류 변경이 과거 문의를 데리고 간다

`inquiries.category` 는 **라벨 문자열**이다. 그래서 수정은 직접 UPDATE 가 아니라 RPC 한 번으로 끝낸다 — 카테고리 행 갱신과 과거 문의 재배치가 **한 트랜잭션**에서 함께 성공하거나 함께 실패한다.

```
update_inquiry_category(p_id, p_key, p_label, p_description, p_prefill,
                        p_sort_order, p_is_active, p_subtypes, p_kind) -> integer
```

| 단계 | 내용 |
|---|---|
| 인가 | `is_admin()` 이 아니면 42501 |
| 종류 검사 | `p_kind` 가 `inquiry·bug·report` 밖이면 22023 "알 수 없는 문의 종류입니다: …" |
| 잠금 | 카테고리 행을 `for update` 로 잡고 옛 `label`·`kind` 를 읽는다. 없으면 P0002 |
| 갱신 | 모든 열을 덮어쓴다. `p_subtypes` 가 null 이면 `'{}'` 로 눕힌다(not null 위반 방지) |
| 연쇄 | 라벨·종류 변경 시 과거 문의 재배치(아래) |
| 반환 | 옮긴 문의 수(`moved`) |

- **연쇄** — `p_label` 또는 `p_kind` 가 **하나라도** 달라졌으면 `update inquiries set category=p_label, kind=p_kind where category=old_label`.
- `key` 는 라벨이 바뀌어도 **유지한다**(액션이 `before.key` 를 그대로 넘긴다). 자동 생성은 등록 때 한 번뿐이다.
- `sort_order` 도 액션이 `before.sort_order` 를 그대로 넘긴다 — 순서는 이 폼이 아니라 ▲▼ + "순서 저장"이 소유한다.
- 인자가 9개다. 하나라도 빼면 함수를 찾지 못해 PGRST202 로 떨어진다(옛 8인자 함수는 마이그레이션에서 `drop` 했다).

**저장 완료 토스트**(`updateMessage`)

| 조건 | 문구 |
|---|---|
| `moved === 0` | "카테고리를 수정했습니다." |
| 라벨·종류 둘 다 변경 | `카테고리를 수정했습니다. 기존 문의 {n}건의 분류와 종류도 함께 바꿨습니다.` |
| 종류만 변경 | `카테고리를 수정했습니다. 이 카테고리로 접수된 문의 {n}건의 종류도 함께 바꿨습니다.` |
| 라벨만 변경 | `카테고리를 수정했습니다. 기존 문의 {n}건의 분류도 새 이름으로 바꿨습니다.` |

## 6. 상태·뱃지 의미

| 뱃지/표시 | 값 | 의미 |
|---|---|---|
| 노출(success) | `is_active = true` | 사용자 폼의 카테고리 선택에 나온다 |
| 숨김(neutral) | `is_active = false` | 사용자 폼에서 사라진다(아래) |
| 문의 {n}건 | `inquiry_category_usage()` | 0 이어야 삭제할 수 있다 |
| 세부 유형 없음 (기타로 접수) | `subtypes = []` | 사용자 폼이 유형 셀렉트를 잠그고 `type='기타'` 로 접수한다 |

- **숨김(neutral)** — 그 라벨로 접수된 과거 문의는 그대로 남고 관리자 필터 옵션에도 남는다.

## 7. 클라이언트와의 상호작용

- 사용자 접수 폼(`/support`, `/support/bug`, `/support/report`)은 `getInquiryCategories(kind)`(`lib/data/inquiry-categories.ts`)로 이 테이블을 읽는다. **창구별 `unstable_cache`**(키 `['inquiry-categories', kind]`, 태그 `inquiry-categories`, `STATIC_REVALIDATE_SECONDS`=300초). kind 마다 따로 감싸지 않으면 먼저 조회한 창구의 목록이 나머지 둘에 새어 나간다.
- 관리자의 모든 쓰기가 `revalidateClient(['inquiry-categories'])` 를 호출해 즉시 반영을 시도한다. 실패해도 최대 300초 뒤 자동 반영된다.
- 폼에 실제로 나가는 값: 카테고리 `label`(선택 상자), `description`(선택 아래 한 줄), `prefill`(문의 내용 칸에 그대로 채워짐), `subtypes`(세부 문의 유형 셀렉트, 순서 그대로).
- 조회가 실패하면 사용자 폼은 `INQUIRY_CATEGORY_FALLBACK[kind]` 로 떨어진다 — 접수는 되고 프리필만 빠진다. 하필 장애 때 "접속이 안 된다"는 제보 창구가 닫히는 것이 더 나쁘다.
- 사용자의 **문의 수정** 화면은 활성 목록 + **그 문의의 현재 카테고리/유형**을 함께 허용한다(`withLegacyCategory`). 운영자가 카테고리를 숨기거나 이름을 바꿔도 옛 문의의 본문 오타를 고칠 수 있어야 한다.
- 관리자 목록(01-list-web)의 카테고리·유형 필터 옵션도 이 테이블 + 데이터에만 남은 옛 라벨로 구성된다.

## 8. 오류·예외

| 상황 | 결과 |
|---|---|
| 목록 조회 실패 | `hasError` → `LIST_LOAD_ERROR` 배너, 섹션 3개는 빈 상태로 그린다 |
| 사용 건수 집계 실패 | 빈 Map → 모든 행이 "문의 0건"으로 보인다(아래) |
| 이름 중복(23505) | 필드 오류 "이미 같은 이름의 카테고리가 있습니다."(아래) |
| 카테고리가 사라짐 | "카테고리를 찾을 수 없습니다." |
| 삭제 전 카운트 질의 실패 | "문의 수를 확인하지 못해 삭제를 중단했습니다. 잠시 후 다시 시도해 주세요." |
| 사용 중인 카테고리 삭제 시도 | `이 카테고리로 접수된 문의가 {n}건 있습니다. 삭제 대신 비활성화해 주세요.` |
| 순서 저장 일부 실패 | 앞쪽 몇 건은 이미 저장됐을 수 있다(아래) |
| 정렬 페이로드가 깨짐 | "정렬 정보를 읽지 못했습니다." |
| 등록·수정 실패(그 밖) | "카테고리를 등록/수정하지 못했습니다. 잠시 후 다시 시도해 주세요." |
| 읽기 전용 관리자 | ▲▼·순서 저장·등록·추가·토글·수정·삭제가 전부 렌더되지 않는다(목록·건수 열람만) |

- **사용 건수 집계 실패** — 삭제 버튼도 활성이 된다. 다만 `deleteInquiryCategoryAction` 이 `inquiries` 를 라벨로 **다시 세므로** 실제 삭제는 여전히 막힌다(화면만 어긋난다).
- **이름 중복(23505)** — `label` 은 kind 와 무관하게 전역 유니크다.
- **순서 저장 일부 실패** — 행마다 UPDATE 를 던지므로 앞쪽 몇 건은 이미 저장됐을 수 있다 → "순서를 저장하지 못했습니다. 일부만 반영됐을 수 있으니 새로고침해 순서를 확인해 주세요."
