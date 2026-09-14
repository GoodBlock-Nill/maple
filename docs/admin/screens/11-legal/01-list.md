# Legal — 문서 목록 (`/legal`)

**목적** 약관·정책 문서 4종의 상태(시행 중·예약·초안)를 한눈에 보고, **지금 할 일**로 바로 들어간다. 문서 수가 고정이라 표·검색·정렬·페이지가 없다 — 거의 늘어나지 않는 목록에 그것들을 붙이면 매번 같은 몇 줄을 훑게 된다.

카드의 첫 버튼은 상태를 따라간다. 이어서 고칠 초안이 있으면 그 초안을 열고, 없으면 발행본을 복사해 새 초안을 연다. 예전의 `편집` 한 개는 둘 중 무엇이 일어날지 알려 주지 않았고, 발행본은 애초에 고칠 수 없어 이름 자체가 사실과 달랐다.

**데이터 출처** `listLegalDocuments()`(`admin/lib/data/legal.ts`)가 `legal_documents` 를 개정본 임베드(`legal_document_versions(...)`)와 함께 한 번에 읽는다.

- 화면에는 `LEGAL_DOCUMENTS` 배열 순서대로 4장을 항상 그린다. DB 에 행이 없어도 카드는 나온다.
- 세션 클라이언트로 읽으므로 임시저장·예약·지난 버전이 모두 보인다(`legal_versions_select_admin`).
- 실패 시 `console.error('[legal] 목록 조회 실패')` 후 빈 데이터로 계속 그린다(배너 없음 → 전 카드가 "미발행"처럼 보인다).
- 카드마다 `state = resolveLegalDocumentState(versions)` 를 계산한다(→ [README](README.md) §2).
- `state.current` 는 사용자 사이트가 지금 읽는 개정본, `state.scheduled` 는 다음 예약본(가장 가까운 시행일)이다.
- `state.drafts` 는 미발행 개정본을 최신 생성순으로 담는다. `versionCount` 는 `versions.length` 다.

## 1.1 문서 카드 (`LegalDocumentCard` × 4)

배치는 `lg:grid-cols-3` 이다.

| 필드/컨트롤 | 종류 | 값의 출처 | 없을 때 |
|---|---|---|---|
| 카드 제목 | 텍스트 | `LEGAL_DOCUMENTS[].label` | — |
| 카드 설명 | 텍스트 | `/policy/{slug} · 개정본 {N}건` | `개정본 0건` |
| 상태 뱃지 | 뱃지(헤더 action) | `current` 유무 + 파생 상태 | `미발행`(warn) |
| 시행 중 / 노출 중 | 정의 목록 | `current.version · current.effectiveDate` | `-` |
| 예약 | 정의 목록 | `scheduled.version · scheduled.effectiveDate` | 줄 자체를 그리지 않음 |
| 초안 | 정의 목록 | `{N}건 · 최근 {최신 초안 createdAt}` | `없음` |
| 초안 이어서 편집 | 버튼(primary, sm) | `?version={최신 초안 id}` | 초안이 있을 때만 |
| 새 초안 만들기 | 버튼(primary, sm) | `?from={current.id}` 또는 `?from=new` | 초안이 없을 때만 |
| 현재 발행본 보기 | 버튼(secondary, sm) | `?version={current.id}` | `current` 가 있을 때만 |
| 버전 이력 | 버튼(secondary, sm) | `?tab=history` | write 권한자에게만 |
| 클라이언트 ↗ | 외부 링크 | `clientSiteUrl()` + 경로 | 항상 노출 |

**동작 상세**

- **카드 제목** 값은 개인정보처리방침·디스코드 운영정책·글자월드 운영정책·마케팅 정보 수신 동의다. DB `legal_documents.title` 이 아니라 코드 상수를 쓴다.
- **상태 뱃지** `current` 가 있으면 `deriveLegalStatus(current, current.version)` 결과를 그린다.
- **시행 중 / 노출 중** 줄 이름은 `legalCurrentTerm()` 이 정한다 — `current` 가 아직 시행 전이면 `노출 중` 이다(→ [README](README.md) §2).
- **시행 중 / 노출 중** 날짜는 `2026-09-18` 원본 표기 그대로다. 이 카드에서는 `2026년 9월 18일` 로 변환하지 않는다.
- **예약** `current` 와 겹치지 않는다. 예약본이 여러 건이면 시행일이 가장 가까운 것 하나만 적는다.
- **초안** 건수는 `state.drafts.length`, 시각은 최신 초안의 `created_at`(`formatDateTime`)이다. 개정본에는 수정 시각 컬럼이 없어 만든 시각을 쓴다.
- **초안 이어서 편집** 최신 초안을 편집 탭에서 연다. 초안이 여러 건이면 나머지는 버전 칩·이력 탭에서 고른다.
- **새 초안 만들기** `current` 가 있으면 그 본문을 복사하고(`?from={id}`), 없으면 빈 본문으로 연다(`?from=new`).
- **현재 발행본 보기** 발행본은 읽기 전용으로 열린다(→ [03-version-form.md](03-version-form.md) §1.2).
- **버전 이력** 이동 경로는 `/legal/{slug}?tab=history` 다. 예전의 `#history` 앵커를 대신한다.
- **클라이언트 ↗** 사용자 사이트 `/policy/{slug}` 를 새 창(`target="_blank" rel="noreferrer"`)으로 연다. 권한과 무관하게 항상 보인다.

**동작(서버 액션)** 이 화면에는 쓰기 액션이 없다(카드 목록뿐).

**상태·뱃지 의미**

`deriveLegalStatus` 와 `LEGAL_STATUS_LABEL`·`LEGAL_STATUS_TONE` 이 정한다.

| 값 | 라벨 | 색 | 언제 |
|---|---|---|---|
| (현재 발행본 없음) | 미발행 | warn | 발행본이 한 건도 없다 |
| `draft` | 임시저장 | neutral | `is_published = false` |
| `scheduled` | 예약 | warn | 발행본이고 시행일이 미래다 |
| `published` | 시행 중 | success | 지금 시행 중인 바로 그 버전 |
| `superseded` | 지난 버전 | neutral | 더 늦은 시행본에 밀렸다 |

**상태 상세**

- **미발행** 임시저장만 있거나 문서 행 자체가 없다. 사용자 사이트는 코드 문안으로 폴백한다.
- **예약** 판정 기준은 `effective_date > 오늘(KST)` 이다.
- **시행 중** `selectCurrentLegalVersion` 이 고른 버전과 같을 때다.
- **카드 뱃지의 한계** `deriveLegalStatus(current, current.version)` 로 계산하므로 `published` 또는 `scheduled` 만 나온다. 자기 자신을 현재 버전으로 넘기기 때문에 `superseded` 가 나오지 않고, `current` 는 정의상 발행본이라 `draft` 도 나오지 않는다.
- **카드 뱃지의 한계** `임시저장`·`지난 버전` 라벨은 편집 화면의 이력 탭에서 볼 수 있다.
- **예약만 있는 문서** 뱃지는 `예약` 이고 첫 줄 이름은 `노출 중` 이다 — 시행 전이지만 사용자 화면에는 그 개정본이 보인다.

**클라이언트와의 상호작용**

- 사용자 사이트 `/policy/[slug]`(`app/(public)/policy/[slug]/page.tsx` → `lib/data/legal.ts`)는 DB 함수 `current_legal_version(slug)` 를 RPC 로 호출해 "지금 시행 중인 문안" 한 줄을 읽는다.
- 캐시는 `unstable_cache` 300초, 태그 `legal` 이다. 이 카드의 `현재 발행 버전`·`시행일` 과 같은 값이어야 한다.
- 발행본이 없으면(= `미발행`) 사용자 화면은 코드 문안 `lib/content/policy-fallback.ts` 의 `POLICY_FALLBACKS[slug]` 로 폴백한다. 약관 페이지는 DB 상태와 무관하게 항상 열려 있어야 하기 때문이다.
- 그때는 버전·시행일도 코드 상수 값이 찍힌다.
- `generateStaticParams()` 가 4개 슬러그를 미리 만들므로 사용자 경로는 항상 존재한다. 슬러그 밖 값은 404 다.

**오류·예외**

- 문서 행이 아직 없어도(시드 전) 카드는 그려진다. 편집 화면에서 처음 저장할 때 `ensureDocumentId()` 가 `legal_documents` 행을 자동으로 만든다(`title` 은 `legalDocumentLabel(slug)`).
- 조회 실패와 "정말 미발행"은 화면에서 구분되지 않는다(원인은 서버 로그).
- 읽기 전용(`legal: read`) 관리자에게는 `클라이언트 ↗` 만 남아, 이 화면에서 할 수 있는 일이 사실상 없다.
- 초안이 여러 건이면 첫 버튼은 **가장 최근 초안**만 가리킨다. 나머지는 상세 화면의 버전 칩 또는 이력 탭에서 연다.
