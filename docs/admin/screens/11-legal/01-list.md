# Legal — 문서 목록 (`/legal`)

**목적** 약관·정책 문서 4종의 발행 현황(현재 버전·시행일·마지막 수정·개정본 수)을 한눈에 보고 편집 화면으로 들어간다. 문서 수가 고정이라 표·검색·정렬·페이지가 없다 — 거의 늘어나지 않는 목록에 그것들을 붙이면 매번 같은 몇 줄을 훑게 된다.

**데이터 출처** `listLegalDocuments()`(`admin/lib/data/legal.ts`)가 `legal_documents` 를 개정본 임베드(`legal_document_versions(...)`)와 함께 한 번에 읽는다.

- 화면에는 `LEGAL_DOCUMENTS` 배열 순서대로 4장을 항상 그린다. DB 에 행이 없어도 카드는 나온다.
- 세션 클라이언트로 읽으므로 임시저장·예약·지난 버전이 모두 보인다(`legal_versions_select_admin`).
- 실패 시 `console.error('[legal] 목록 조회 실패')` 후 빈 데이터로 계속 그린다(배너 없음 → 전 카드가 "미발행"처럼 보인다).
- 카드마다 `current = selectCurrentLegalVersion(versions)` 를 계산한다.
- `latest` 는 `createdAt` 내림차순 첫 개정본, `versionCount` 는 `versions.length` 다.

## 1.1 문서 카드 (`LegalDocumentCard` × 4)

배치는 `lg:grid-cols-3` 이다.

| 필드/컨트롤 | 종류 | 값의 출처 | 없을 때 |
|---|---|---|---|
| 카드 제목 | 텍스트 | `LEGAL_DOCUMENTS[].label` | — |
| 카드 설명 | 텍스트 | `/policy/{slug}` | — |
| 상태 뱃지 | 뱃지(헤더 action) | `current` 유무 + 파생 상태 | `미발행`(warn) |
| 현재 발행 버전 | 정의 목록 | `current.version` | `-` |
| 시행일 | 정의 목록 | `current.effectiveDate` | `-` |
| 마지막 수정 | 정의 목록 | `latest.createdAt` | `-` |
| 개정본 | 정의 목록 | `versionCount` | `0건` |
| 편집 | 버튼(sm) | — | write 권한자에게만 |
| 버전 이력 | 버튼(secondary) | — | write 권한자에게만 |
| 클라이언트 ↗ | 외부 링크 | `clientSiteUrl()` + 경로 | 항상 노출 |

**동작 상세**

- **카드 제목** 값은 개인정보처리방침·디스코드 운영정책·글자월드 운영정책·마케팅 정보 수신 동의다. DB `legal_documents.title` 이 아니라 코드 상수를 쓴다.
- **상태 뱃지** `current` 가 있으면 `deriveLegalStatus(current, current.version)` 결과를 그린다.
- **시행일** `2026-09-18` 원본 표기 그대로다. 이 카드에서는 `2026년 9월 18일` 로 변환하지 않는다.
- **마지막 수정** `formatDateTime` 표기이며 가장 최근에 만든 개정본의 생성 시각이다. 임시저장도 포함하며 발행 시각이 아니다.
- **편집** 이동 경로는 `/legal/{slug}` 다.
- **버전 이력** 이동 경로는 `/legal/{slug}#history` 다.
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
- **카드 뱃지의 한계** `임시저장`·`지난 버전` 라벨은 편집 화면의 버전 이력에서 볼 수 있다.

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
