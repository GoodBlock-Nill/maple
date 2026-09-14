# Legal — 문서 편집 화면 (`/legal/[slug]`)

**목적** 한 문서의 개정본을 열어 보고, 새 초안을 만들고, 사용자 사이트와 같은 서식으로 미리보고, 두 버전을 비교하고, 이력을 훑는다. 화면은 **탭 세 개**(편집 · 미리보기 · 이력·비교)로 나뉘고 활성 탭만 서버에서 그린다. 편집 폼 자체는 [03-version-form.md](03-version-form.md)에서 다룬다.

**데이터 출처**

- `requirePermission('legal','write')` — read 만으로는 열리지 않는다.
- `isLegalSlug(slug)` 실패 시 `notFound()`.
- `getLegalDocument(slug)`(`admin/lib/data/legal.ts`)가 문서와 개정본 전체를 `created_at` 내림차순으로 읽는다.
- 문서 행이 없으면 `versions = []` 이다.
- `state = resolveLegalDocumentState(versions, today)` 로 시행 중·예약·초안을 나눈다. `current = state.current` 다.
- `tab = parseLegalTab(search.tab)` — 모르는 값은 `edit` 으로 떨어진다.

**URL 파라미터** 화면 상태는 전부 쿼리스트링이다. 컴포넌트 상태로 두면 새로고침·뒤로가기에서 초기화되고, "이 비교 화면"을 링크로 남길 수 없다.

| 파라미터 | 뜻 | 규칙 |
|---|---|---|
| `?tab=` | 보고 있는 패널 | `edit`(기본) · `preview` · `history` |
| `?version=<id>` | 열어 볼 개정본 | 없으면 `current` → 목록 첫 번째 |
| `?from=<id>` | 본문만 복사한 빈 초안 | `version` 보다 우선 |
| `?base=<id>` | 비교 기준 | 이력 탭에서, 열람 중과 다를 때만 표시 |
| `?saved=1` | 저장 후 표시 | 화면에서 읽는 코드는 없다 |

- **`?tab=`** 탭은 `<Link>` 세 개다(자바스크립트 상태가 아니다). 새로고침·뒤로가기·링크 공유가 모두 같은 화면을 재현한다.
- **`?tab=`** 활성 패널만 렌더한다 — 보지 않는 탭의 미리보기 HTML·비교 계산을 아예 만들지 않는다.
- **`?tab=`** 다른 키는 유지된다(`buildHref`). 초안을 열어 둔 채 미리보기로 갔다가 편집으로 돌아와도 같은 개정본이다.
- **`?from=`** 없는 id(예: `from=new`)면 빈 본문 초안이 열린다.
- **폼 재마운트** 폼은 `key={versionId:version}` 로 다시 마운트된다. 라우트 전환에서 React 가 인스턴스를 재사용하면 라디오 선택과 에디터 문서가 이전 개정본 값으로 남아 그대로 저장되기 때문이다.

## 1.1 페이지 헤더

| 필드/컨트롤 | 종류 | 값의 출처 | 동작 |
|---|---|---|---|
| 제목 | 텍스트 | `{문서 라벨} 편집` | — |
| 설명 | 텍스트 | 발행본 유무에 따라 갈린다 | 아래 상세 |
| 상태 뱃지 | 뱃지 | `previewStatus` | 폼에 열린 개정본의 상태 |
| 클라이언트에서 보기 | 버튼(새 창) | `clientSiteUrl()` + 경로 | `/policy/{slug}` |

**동작 상세**

- **설명** 발행본이 없으면 "아직 발행본이 없습니다. 저장하면 사용자 사이트가 코드 문안 대신 이 문안을 읽습니다." 가 나온다.
- **설명** 있으면 `{시행 중|노출 중} {version} · 시행일 {effectiveDate} · 개정본 {N}건` 이다(이름은 `legalCurrentTerm()`).
- **상태 뱃지** 계산식은 `deriveLegalStatus({ version, effectiveDate, isPublished: target.isReadOnly, publishedAt: null }, current?.version, today)` 다.
- **상태 뱃지** 초안·복사본은 아직 발행 전이라 항상 `임시저장` 이다.
- **클라이언트에서 보기** `target="_blank" rel="noopener noreferrer"` 다.

## 1.2 버전 칩 (`LegalVersionStrip`, `data-testid="legal-version-strip"`)

머리글 바로 아래 한 줄. 이력 탭을 열지 않아도 "지금 무엇이 걸려 있는지" 보이고, 그 자리에서 해당 개정본을 연다. 칩은 전부 `?version={id}` 링크다(`from`·`saved` 는 지운다).

| 칩 | 문구 | 색 |
|---|---|---|
| 시행 중 / 노출 중 | `{시행 중\|노출 중} {version}` | success / warn |
| 예약 | `예약 {version} ({M/D}부터)` | warn |
| 초안(3건 이하) | 초안마다 `초안 {version}` | neutral |
| 초안(4건 이상) | `초안 {최신 version} 외 {N-1}건` | neutral |

- **문구** `legalStripChips(state, today)` 가 만든다. 색은 뱃지와 같은 `LEGAL_STATUS_TONE` 을 쓴다.
- **시행 중 / 노출 중** 이름 규칙은 카드와 같다(→ [README](README.md) §2).
- **예약 날짜** `10/1` 처럼 월/일만 적는다 — 칩은 한 줄이라 연도까지 적을 자리가 없다.
- **현재 열린 개정본** `aria-current="true"` 와 두꺼운 테두리(ring)로 표시한다.
- **개정본이 하나도 없으면** 줄 자체를 그리지 않는다.

## 1.3 탭 (`LegalTabs`)

| 탭 | `?tab=` | 그리는 것 |
|---|---|---|
| 편집 | `edit`(기본) | 잠금 배너(발행본일 때) + `LegalForm` |
| 미리보기 | `preview` | `LegalPreview` |
| 이력·비교 | `history` | `LegalDiffView`(`?base=` 있을 때) + `LegalVersionHistory` |

- **활성 탭** `aria-current="page"` 이고 밑줄이 accent 색이다.
- **이력 탭** 컨테이너에 `id="history"` 가 남아 있어 예전 `#history` 링크도 문서 안에서 같은 자리를 가리킨다.

## 1.4 편집 폼 (`LegalForm`, 편집 탭)

2열 레이아웃이다(본문 좌측, 발행 카드는 `lg:sticky`). 필드별 설명은 [03-version-form.md](03-version-form.md) 참고.

발행본을 열면 폼 위에 잠금 배너(`LegalReadOnlyBanner`, `data-testid="legal-readonly-banner"`)가 붙는다.

| 요소 | 값 |
|---|---|
| 제목 | `발행된 개정본은 수정할 수 없습니다.` |
| 설명 | `문안을 바꾸려면 이 버전을 복사한 새 초안에서 작업하세요.` |
| 주 버튼 | `이 버전으로 새 초안 만들기` → `?from={열람 중 id}&tab=edit` |
| 보조 버튼 | `이력 보기` → `?tab=history` |

- **자리** 폼 맨 위다. 잠긴 폼을 마주한 운영자가 먼저 묻는 것이 "왜 안 고쳐지는가"인데, 그 답이 화면 끝에 있으면 잠금을 고장으로 읽는다.
- **색** `warn` 계열(연노랑 바탕)이고 `role="status"` 다.

## 1.5 클라이언트 미리보기 (`LegalPreview`, 미리보기 탭)

테스트 훅은 `data-testid="legal-preview"` 다.

| 요소 | 값 | 규칙 |
|---|---|---|
| 카드 머리 | `클라이언트 미리보기` | 상태 뱃지 포함 |
| 제목 | `legalDocumentLabel(slug)` | 사용자 `<h1>` 과 같은 크기 규칙 |
| 시행일 | `formatEffectiveDate()` | `2026년 9월 18일` 형식 |
| 버전 알약 | `버전 {version}` | — |
| 목차 | `policyTocEntries(contentHtml)` | `<h2>` 가 항목이 된다 |
| 본문 | `renderPolicyHtml(contentHtml)` | 사용자 렌더러와 같은 계약 |

**동작 상세**

- **카드 머리** 설명 문구는 "저장된 내용을 사용자 사이트와 같은 서식으로 그립니다. 편집 중인 내용은 저장해야 반영됩니다." 다.
- **카드 머리** 저장된 값 기준이라 에디터에서 방금 친 글자는 반영되지 않는다.
- **제목** 크기 규칙은 `clamp(28px,4vw,44px)` 다.
- **시행일** 사용자 사이트 `lib/data/legal.ts` 의 같은 이름 함수와 한 글자도 달라선 안 된다.
- **목차** `<h2>` 가 없으면 목차 상자 자체를 그리지 않는다.
- **본문** 저장 직전 `sanitizeLegalHtml()` 을 통과한 값만 들어오므로 `dangerouslySetInnerHTML` 이 의도된 선택이다.
- **본문** `renderPolicyHtml()` 은 앵커 id 와 표 스크롤 상자만 덧붙인다. 사용자 사이트 `PolicyHtmlBody` 와 같은 계약이다.
- **색 토큰** `.legal-preview` 안에서만 사용자 사이트 값으로 덮어쓴다(`admin/app/globals.css`).

## 1.6 버전 비교 (`LegalDiffView`, 이력·비교 탭)

`?base=` 를 지정했고 열람 중인 개정본과 다를 때만 카드를 그린다(이력 표 위에 놓인다).

| 요소 | 값 |
|---|---|
| 제목 | `{base.version} → {target.version} 비교` |
| 설명 | `추가 {N}줄 · 삭제 {M}줄` + 단위 안내 |
| 줄 표시 | 부호 + 텍스트 |
| 같을 때 | "두 버전의 문안이 같습니다." |

**동작 상세**

- **설명** 뒷부분 문구는 "문단·목록 항목·표의 한 행을 각각 한 줄로 봅니다." 다.
- **줄 표시** `htmlToDiffLines()` 가 태그가 아니라 문장 단위로 쪼갠다. HTML 을 그대로 비교하면 표 한 칸만 바뀌어도 문서 전체가 달라 보이기 때문이다.
- **줄 표시** `same` 은 회색과 공백, `added` 는 초록 배경에 `+`, `removed` 는 빨강 배경에 취소선과 `−` 다.
- **줄 표시** 색만으로 구분하지 않고 기호를 함께 둔다(색각 이상 대응).
- **영역** `max-h-[520px]` 스크롤이다.

## 1.7 버전 이력 (`LegalVersionHistory`, 이력·비교 탭)

카드 머리는 `버전 이력` 이고 설명은 "발행한 개정본은 고치지 않고 새 버전을 쌓습니다. 분쟁 시점의 문안을 되짚을 수 있어야 하기 때문입니다." 다. 헤더 액션 `빈 초안 만들기` 는 `?from=new&tab=edit` 로 이동한다(존재하지 않는 id 라 본문이 빈 초안이 열린다).

| 열 | 값의 출처 | 표시·동작 |
|---|---|---|
| 버전 | `version` | 열려 있으면 `·` 점 강조 |
| 시행일 | `effective_date` | 원본 `YYYY-MM-DD` |
| 상태 | 파생값 | `deriveLegalStatus(row, currentVersion)` |
| 변경 요약 | `summary` | 비면 `-` |
| 만든 날짜 | `created_at` | `formatDateTime` |
| 동작 | — | 보기 · 새 초안 만들기 · 비교 |

**동작 상세**

- **정렬** 최신 생성순 고정이며 정렬을 바꾸는 UI 가 없다.
- **상태** 라벨은 `임시저장`·`예약`·`시행 중`·`지난 버전` 이다.
- **보기** 이동 경로는 `?version={id}&base={현재 base}&tab=edit` 다 — 비교 기준은 유지한 채 열람 대상만 바꾸고 편집 탭으로 간다.
- **새 초안 만들기** 이동 경로는 `?from={id}&tab=edit` 다. 본문만 복사하고 버전·시행일은 오늘 기준 기본값, 요약은 빈 값이다.
- **비교** 이동 경로는 `?version={열람 중 id}&base={이 행 id}&tab=history` 이고 `aria-label` 은 `{version} 과 비교` 다.
- **비교** 이력 탭에 머문다 — 두 버전을 잇달아 견주려면 표가 그대로 보여야 한다.
- **빈 목록** 문구는 `아직 개정본이 없습니다.` 다.

**클라이언트와의 상호작용**

- 이 화면이 "현재 시행"이라고 부르는 버전은 사용자 사이트 `/policy/[slug]` 가 RPC `current_legal_version(slug)` 으로 고르는 버전과 같아야 한다(규칙은 → [README](README.md) §2).
- 관리자 쪽 구현은 `selectCurrentLegalVersion()` 이고 단위 테스트로 못 박혀 있다.
- 사용자 화면은 DB 에서 받은 `content_html` 을 한 번 더 `sanitizeLegalHtml()` 로 깎아서 그린다. 정제기가 바뀌면 과거 행에도 새 규칙이 적용되고, DB 를 직접 고친 값이 그대로 나가지 못한다.
- 사용자 화면 목차(`PolicyToc`)는 발행본이면 `<h2>` 에서, 폴백 문안이면 장 번호에서 만든다. 미리보기 목차와 같은 함수(`policyTocEntries`)를 쓴다.
- 임시저장만 있는 문서는 사용자 화면이 코드 문안을 계속 보여 준다(`document === null` → `POLICY_FALLBACKS`).

**오류·예외**

- `legal: read` 만 가진 관리자가 URL 로 직접 들어오면 `/?error=forbidden` 으로 되돌아간다.
- `?version=` 이 다른 문서의 개정본 id 이거나 없는 값이면 조용히 `current`(또는 첫 개정본)로 떨어진다.
- 발행본을 열면 폼이 통째로 잠기고 저장 버튼 자체가 없다 — "눌러도 아무 일이 없는 버튼"을 남기지 않는다.
- 이어갈 길은 두 가지다: 편집 탭 위 배너의 `이 버전으로 새 초안 만들기`, 이력 탭 각 행의 `새 초안 만들기`.
- `?tab=` 에 모르는 값을 넣으면 편집 탭으로 떨어진다(404 가 아니다).
- 비교는 열람 중인 개정본과 `base` 가 같으면 렌더되지 않는다(같은 문서 비교 방지).
