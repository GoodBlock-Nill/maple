# Legal — 문서 편집 화면 (`/legal/[slug]`)

**목적** 한 문서의 개정본을 열어 보고, 새 초안을 만들고, 사용자 사이트와 같은 서식으로 미리보고, 두 버전을 비교하고, 이력을 훑는다. 편집 폼 자체는 [03-version-form.md](03-version-form.md).

**데이터 출처** `requirePermission('legal','write')`(**read 만으로는 열리지 않는다**) → `isLegalSlug(slug)` 실패 시 `notFound()` → `getLegalDocument(slug)`(`admin/lib/data/legal.ts`) 로 문서와 개정본 전체를 `created_at` 내림차순으로 읽는다. 문서 행이 없으면 `versions = []`. `today = kstToday()`, `current = selectCurrentLegalVersion(versions, today)`.

**화면 상태는 전부 쿼리스트링**(컴포넌트 상태로 두면 새로고침·뒤로가기에서 초기화되고, "이 비교 화면"을 링크로 남길 수 없다).

| 파라미터 | 뜻 | 규칙 |
|---|---|---|
| `?version=<id>` | 열어 볼 개정본 | 없으면 `current` → 그것도 없으면 목록 첫 번째(가장 최근 생성) |
| `?from=<id>` | 그 개정본의 **본문만 복사한 빈 초안** | `version` 보다 우선. 없는 id(예: `from=new`)면 빈 본문 초안이 열린다 |
| `?base=<id>` | 비교 기준 | 지정했고 열람 중인 개정본과 다를 때만 비교 카드가 뜬다 |
| `?saved=1` | 저장 후 리다이렉트 표시 | 액션이 붙여 보내지만 화면에서 읽는 코드는 없다 |

폼은 `key={`${versionId}:${version}`}` 로 다시 마운트된다 — 라우트 전환에서 React 가 인스턴스를 재사용하면 라디오 선택과 에디터 문서가 이전 개정본 값으로 남아 그대로 저장된다.

## 1.1 페이지 헤더

| 필드/컨트롤 | 종류 | 값의 출처 | 동작 / 상호작용 |
|---|---|---|---|
| 제목 | 텍스트 | `${legalDocumentLabel(slug)} 편집` | — |
| 설명 | 텍스트 | 발행본이 없으면 "아직 발행본이 없습니다. 저장하면 사용자 사이트가 코드 문안 대신 이 문안을 읽습니다." / 있으면 `현재 시행 {version} · 시행일 {effectiveDate} · 개정본 {N}건` | 코드 문안 폴백에서 DB 문안으로 넘어가는 시점을 알린다 |
| 상태 뱃지 | 뱃지 | `previewStatus` = `deriveLegalStatus({ version, effectiveDate, isPublished: target.isReadOnly, publishedAt: null }, current?.version, today)` | **지금 폼에 열려 있는 개정본**의 상태다. 초안·복사본은 아직 발행 전이라 항상 `임시저장` |
| 클라이언트에서 보기 | 버튼(secondary, 새 창) | `clientSiteUrl() + /policy/{slug}` | `target="_blank" rel="noopener noreferrer"` |

## 1.2 편집 폼 (`LegalForm`)

2열 레이아웃(본문 좌측 / 발행 카드는 `lg:sticky`). 필드별 설명은 [03-version-form.md](03-version-form.md).

## 1.3 클라이언트 미리보기 (`LegalPreview`, `data-testid="legal-preview"`)

| 요소 | 값 | 규칙 |
|---|---|---|
| 카드 머리 | `클라이언트 미리보기` + 설명 "저장된 내용을 사용자 사이트와 같은 서식으로 그립니다. 편집 중인 내용은 저장해야 반영됩니다." + 상태 뱃지 | **저장된 값 기준** — 에디터에서 방금 친 글자는 반영되지 않는다 |
| 제목 | `legalDocumentLabel(slug)` | 사용자 사이트 `<h1>` 과 같은 크기 규칙(`clamp(28px,4vw,44px)`) |
| 시행일 · 버전 알약 | `시행일 {formatEffectiveDate(effectiveDate)}` · `버전 {version}` | `2026-09-18` → `2026년 9월 18일`. 사용자 사이트 `lib/data/legal.ts` 의 같은 이름 함수와 한 글자도 달라선 안 된다 |
| 목차 | `policyTocEntries(contentHtml)` | 본문의 `<h2>` 가 항목이 된다. `<h2>` 가 없으면 목차 상자 자체를 그리지 않는다 |
| 본문 | `renderPolicyHtml(contentHtml)` | 저장 직전 `sanitizeLegalHtml()` 을 통과한 값만 들어오므로 `dangerouslySetInnerHTML` 이 의도된 선택이다. 앵커 id 와 표 스크롤 상자만 덧붙인다 — 사용자 사이트 `PolicyHtmlBody` 와 같은 계약 |

색 토큰은 `.legal-preview` 안에서만 사용자 사이트 값으로 덮어쓴다(`admin/app/globals.css`).

## 1.4 버전 비교 (`LegalDiffView`, `?base=` 지정 시에만)

| 요소 | 값 | 규칙 |
|---|---|---|
| 제목 | `{base.version} → {target.version} 비교` | — |
| 설명 | `추가 {N}줄 · 삭제 {M}줄. 문단·목록 항목·표의 한 행을 각각 한 줄로 봅니다.` | `htmlToDiffLines()` 가 태그가 아니라 **문장 단위**로 쪼갠다 — HTML 을 그대로 비교하면 표 한 칸만 바뀌어도 문서 전체가 달라 보인다 |
| 줄 | 부호 + 텍스트 | `same` 회색(공백), `added` 초록 배경 `+`, `removed` 빨강 배경 + 취소선 `−`. **색만으로 구분하지 않고 기호를 함께 둔다**(색각 이상 대응) |
| 같을 때 | "두 버전의 문안이 같습니다." | 추가·삭제가 0줄일 때 |

표시 영역은 `max-h-[520px]` 스크롤. `base` 가 열람 중인 개정본과 같으면 카드를 그리지 않는다.

## 1.5 버전 이력 (`LegalVersionHistory`, `#history`)

카드 머리: `버전 이력` + "발행한 개정본은 고치지 않고 새 버전을 쌓습니다. 분쟁 시점의 문안을 되짚을 수 있어야 하기 때문입니다." + 헤더 액션 `빈 초안 만들기`(→ `?from=new`, 존재하지 않는 id 라 본문이 빈 초안이 열린다).

| 열 | 종류 | 값의 출처 | 동작 / 상호작용 |
|---|---|---|---|
| 버전 | 텍스트(굵게) | `version` | 지금 열려 있는 개정본이면 뒤에 `·` 점 강조 |
| 시행일 | 텍스트 | `effective_date`(원본 `YYYY-MM-DD`) | — |
| 상태 | 뱃지 | `deriveLegalStatus(row, currentVersion)` | `임시저장`·`예약`·`시행 중`·`지난 버전` |
| 변경 요약 | 텍스트 | `summary` | 비면 `-` |
| 만든 날짜 | 일시 | `created_at`(`formatDateTime`) | 정렬 기준(최신순 고정, 정렬 변경 불가) |
| 보기 | 링크 버튼(ghost) | — | `?version={id}&base={현재 base}` — 비교 기준은 유지한 채 열람 대상만 바꾼다 |
| 새 초안 만들기 | 링크 버튼(ghost) | — | `?from={id}` — 그 개정본의 **본문만** 복사하고 버전·시행일은 오늘 기준 기본값으로 초기화한다(요약은 비운다) |
| 비교 | 링크 버튼(ghost) | — | `?version={열람 중 id}&base={이 행 id}`. `aria-label="{version} 과 비교"` |

빈 목록 문구 `아직 개정본이 없습니다.`

**클라이언트와의 상호작용**

- 이 화면이 "현재 시행"이라고 부르는 버전은 사용자 사이트 `/policy/[slug]` 가 RPC `current_legal_version(slug)` 으로 고르는 버전과 **같아야** 한다(규칙은 → [README](README.md) §2). 관리자 쪽 구현은 `selectCurrentLegalVersion()` 이고 단위 테스트로 못 박혀 있다.
- 사용자 화면은 DB 에서 받은 `content_html` 을 **한 번 더** `sanitizeLegalHtml()` 로 깎아서 그린다(정제기가 바뀌면 과거 행에도 새 규칙이 적용되고, DB 를 직접 고친 값이 그대로 나가지 못한다).
- 사용자 화면 목차(`PolicyToc`)는 발행본이면 `<h2>` 에서, 폴백 문안이면 장 번호에서 만든다. 미리보기 목차와 같은 함수(`policyTocEntries`)를 쓴다.
- 임시저장만 있는 문서는 사용자 화면이 코드 문안을 계속 보여 준다(`document === null` → `POLICY_FALLBACKS`).

**오류·예외**

- `legal: read` 만 가진 관리자가 URL 로 직접 들어오면 `/?error=forbidden` 으로 되돌아간다.
- `?version=` 이 다른 문서의 개정본 id 이거나 없는 값이면 조용히 `current`(또는 첫 개정본)로 떨어진다.
- 발행본을 열면 폼이 잠겨 있어 **저장 버튼을 눌러도 아무 일이 없다**(비활성). 이력의 `새 초안 만들기` 로만 이어갈 수 있고, 그 사실을 발행 카드 아래 안내 문구가 알려 준다.
- 비교는 열람 중인 개정본과 `base` 가 같으면 렌더되지 않는다(같은 문서 비교 방지).
