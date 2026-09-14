# Legal — 개정본 폼 (`/legal/[slug]` 편집 폼)

**목적** 개정본 하나를 작성해 임시저장하거나, 발행하거나, 시행일을 정해 예약한다. 새 초안과 기존 초안 수정이 한 컴포넌트(`LegalForm`)이며 숨은 `id` 하나로 갈린다. 발행본을 열면 폼 전체가 잠긴다.

**데이터 출처(프리필)** `resolveTarget()`(`admin/app/(admin)/legal/[slug]/page.tsx`)이 세 갈래로 값을 만든다.

| 상황 | versionId | 버전 | 시행일 | 잠금 |
|---|---|---|---|---|
| `?from=<id>`(복사) | `''` | 오늘 `YYYYMMDD` | `kstToday()` | 아니오 |
| `?version=<id>` 또는 현재 시행본 | 그 id | 그 버전 | 그 시행일 | 발행본이면 예 |
| 개정본이 하나도 없음 | `''` | 오늘 `YYYYMMDD` | 오늘 | 아니오 |

**프리필 상세**

- **복사(`?from=`)** 요약은 비우고 본문은 원본 `content_html` 을 그대로 가져온다(없으면 빈 값). 모드는 `draft` 다.
- **열람(`?version=`)** 요약·본문은 그 개정본 값이다. 모드는 `modeOf()` 가 정한다 — 미발행이면 `draft`, 시행일이 오늘보다 뒤면 `schedule`, 그 외는 `publish` 다.
- **없음** 요약·본문이 모두 빈 값이고 모드는 `draft` 다.
- **기본 버전** `defaultLegalVersion()` = `kstToday()` 에서 하이픈을 뺀 값이다.

## 1.1 본문 카드 (좌측)

| 필드/컨트롤 | 종류 | 필수·제한 | 기본값 | 저장 컬럼 |
|---|---|---|---|---|
| slug | hidden | `isLegalSlug()` 통과 | 경로의 slug | — |
| id | hidden | 새 초안이면 렌더 안 함 | `target.versionId` | — |
| 폼 오류 배너 | `FormBanner` | — | 없음 | — |
| 변경 요약 | textarea(2줄) | 선택 ≤200자 | `target.summary` | `summary` |
| 본문 | 리치 에디터 | 필수 | `target.contentHtml` | `content_html` |

**동작 상세**

- **slug** 액션이 `ensureDocumentId(slug)` 로 문서 행을 찾거나 만든다.
- **id** 값이 있으면 update, 없으면 insert 다.
- **변경 요약** 상한 상수는 `LEGAL_SUMMARY_MAX_LENGTH`(200)이고 빈 값은 `null` 로 저장된다.
- **변경 요약** 힌트: "사용자 사이트에는 보이지 않습니다. 버전 이력에서 무엇이 바뀌었는지 알아보는 용도입니다."
- **변경 요약** 이력 표의 `변경 요약` 칸에만 쓰인다.
- **본문** 검증은 `z.string().trim().min(1)` 이고, 정제 후 빈 문자열이면 다시 거절한다.
- **본문** 값은 숨은 input 하나로 전송된다. 에디터 상태를 상위 폼으로 끌어올리면 한 글자마다 리렌더돼 한글 IME 가 끊긴다.
- **본문** 빈 문서(`<p></p>`)는 빈 문자열로 눌러서 보낸다.
- **본문** 힌트: "장(H2)은 사용자 사이트 목차 항목이 됩니다. 표는 머리글 행을 켜 두세요."

### 에디터 툴바 (`LegalToolbar`)

스크롤해도 상단에 고정된다.

| 그룹 | 버튼 | 결과 태그 |
|---|---|---|
| 서식 | `B` 굵게, `I` 기울임 | `<strong>`, `<em>` |
| 제목 | `H2` 장, `H3` 절, `H4` 항 | `<h2>`, `<h3>`, `<h4>` |
| 목록 | `목록`, `번호` | `<ul>`, `<ol>` |
| 링크 | `링크` | `<a>` |
| 표 | `표`, `+행`, `+열`, `−행`, `−열`, `표 삭제` | `<table>` 계열 |

**툴바 상세**

- **제목** h4 까지 여는 이유는 원문에 `3-7 > 가.` 같은 3단 계층이 실제로 있기 때문이다.
- **링크** 인라인 입력창(`InlineUrlField`)이 열린다. `^https?://\S+$` 가 아니면 "http:// 또는 https:// 로 시작하는 주소만 넣을 수 있습니다."가 뜬다.
- **표** `표` 버튼은 3×3 에 머리글 행을 포함해 삽입한다.
- **차이** 뉴스 에디터와 달리 이미지·영상·인용·취소선이 없다.

### 저장 시 HTML 정제 (`sanitizeLegalHtml`)

파일은 `admin/lib/sanitize/legal-html.ts` 다.

| 규칙 | 내용 |
|---|---|
| 허용 태그 | `p br strong em h2 h3 h4 ul ol li a table thead tbody tr th td` |
| 허용 속성 | `a` 태그의 `href`, `rel`, `target` 만 |
| 링크 스킴 | `http`·`https` 만, 프로토콜 상대 URL 금지 |
| 내용까지 버림 | `script style textarea option noscript template iframe` |
| 끝 빈 문단 | `(<p></p>)+$` 제거 |
| 목차 앵커 | `id` 를 허용하지 않는다 |

**정제 상세**

- **허용 태그** 그 밖의 태그는 벗겨지고 안의 텍스트만 남는다.
- **허용 속성** `style`·`class`·`colspan`·`id`·`on*` 은 모두 사라진다.
- **허용 속성** `colspan` 을 열지 않는 이유는 렌더 규칙이 병합 셀을 가정하지 않아 미리보기와 사용자 화면이 갈라지기 때문이다.
- **링크** `http`/`https` 절대 URL 이 아니면 `<a>` 를 `<span>` 으로 바꿔 통째로 벗긴다.
- **링크** 통과한 링크는 `rel="noopener noreferrer nofollow" target="_blank"` 로 덮어쓴다.
- **끝 빈 문단** 에디터가 블록 뒤에 붙이는 빈 줄을 걷어낸다.
- **목차 앵커** 앵커는 렌더 시점에 `policy-prose` 가 문서 순서대로 다시 붙인다.
- **동기화** 사용자 사이트 `lib/sanitize/legal-html.ts` 와 같은 허용 목록이어야 한다. 갈라지면 저장은 되는데 화면에서 사라지거나 그 반대가 된다 — 두 파일은 항상 함께 고친다.

## 1.2 발행 카드 (우측, `LegalPublishFields`)

`<fieldset disabled={isReadOnly}>` 라 발행본을 열면 아래 세 필드가 통째로 잠긴다.

| 필드/컨트롤 | 종류 | 필수·제한 | 기본값 | 저장 결과 |
|---|---|---|---|---|
| 버전 | 텍스트 | 필수, `^\d{8}(-\d{1,2})?$` | 오늘 `YYYYMMDD` | `version` |
| 시행일 | `type="date"` | 필수, 실제 달력 날짜 | 오늘(KST) | `effective_date` |
| 임시저장 | 라디오 | — | 초안이면 선택 | 비공개 |
| 발행 | 라디오 | 시행일 ≤ 오늘 | 조건부 선택 | 즉시 공개 |
| 예약 | 라디오 | 시행일 > 오늘 | 조건부 선택 | 시행일에 공개 |
| 저장 | 제출 버튼 | 잠금 시 비활성 | — | `saveLegalVersionAction` |
| 목록으로 | 버튼(링크) | — | — | `/legal` |

**동작 상세**

- **버전** `maxLength` 는 `LEGAL_VERSION_MAX_LENGTH`(11)이고 DB 제약 `legal_document_versions_version_format` 과 같은 식을 쓴다.
- **버전** 문서 안에서 유니크해야 한다(DB `legal_document_versions_unique_version`).
- **버전** 힌트: "시행일 기준 YYYYMMDD. 같은 날 두 번 고치면 20260909-2 처럼 씁니다. 사용자 사이트 약관 화면의 버전 알약에 그대로 나옵니다."
- **시행일** `isCalendarDate()` 가 `YYYY-MM-DD` 형식과 달력에 실제로 있는 날짜인지 본다 — `2026-02-31` 은 거절된다.
- **시행일** 힌트: "이 날짜부터 사용자 사이트가 이 버전을 보여 줍니다."
- **임시저장** `is_published = false`, `published_at = null` 이다. 설명은 "사용자 사이트에 보이지 않습니다." 이고 저장해도 캐시를 태우지 않는다.
- **발행** `is_published = true`, `published_at = now` 다. 설명은 "저장과 동시에 공개됩니다. 시행일은 오늘 이하여야 합니다." 다.
- **예약** 예약도 `is_published = true` 다. 노출 여부를 가르는 것은 `effective_date` 뿐이고 그 판정은 `current_legal_version()` 한 곳에만 둔다.
- **예약** 설명은 "시행일이 되면 자동으로 이 버전이 노출됩니다." 다.
- **저장** `isPending` 또는 `isReadOnly` 면 비활성이고 진행 중에는 `저장 중…` 이다.
- **잠금 안내** 발행본을 열었을 때만 카드 아래에 문구가 붙는다: "이미 발행한 개정본입니다. 문안을 바꾸려면 아래 이력에서 “이 버전으로 새 초안 만들기”를 눌러 주세요."
- **묶음 이유** 이 문서에서 "예약"은 별도 시각 입력이 아니라 "시행일이 아직 오지 않은 발행본"이다. 상태와 시행일을 떨어뜨려 놓으면 예약을 고르고도 시행일을 오늘로 둬서 즉시 공개되는 사고가 난다.

## 1.3 서버 동작 (`saveLegalVersionAction`)

| 단계 | 내용 |
|---|---|
| 권한 | `requirePermission('legal','write')` |
| 슬러그 | `isLegalSlug()` 검사 |
| 검증 | `legalFormSchema` + `superRefine` 교차 검증 |
| 정제 | `sanitizeLegalHtml(content)` |
| 문서 행 | `ensureDocumentId(slug)` |
| 수정 경로 | 발행본이면 거절, 아니면 `update` |
| 생성 경로 | `insert` + `created_by = actor.id` |
| 감사 | 모드에 따라 action 이 갈린다 |
| 캐시 | 경로 재검증 + 조건부 태그 재검증 |
| 이동 | `redirect('/legal/{slug}?version={id}&saved=1')` |

**동작 상세**

- **문서 행** 없으면 `legal_documents` 를 insert 하며 `title` 은 `legalDocumentLabel(slug)` 다.
- **수정 경로** 같은 문서의 개정본인지 먼저 확인한다.
- **감사** 발행·예약이면 `legal.publish`, 아니면 신규는 `legal.create`, 수정은 `legal.update` 다.
- **감사** before/after 는 `{ slug, version, effectiveDate, isPublished }` 스냅샷이다.
- **캐시** `revalidatePath('/legal')` 와 `revalidatePath('/legal/{slug}')` 는 항상 부른다.
- **캐시** `revalidateClient(['legal'])` 는 발행·예약일 때만 부른다.
- **이동** 재검증을 반드시 리다이렉트 앞에 둔다 — `redirect()` 는 예외를 던져 이후 코드를 건너뛴다.
- **발행 플랜** `resolveLegalPublishPlan(mode)` 가 `draft` 면 `{ is_published:false, published_at:null }`, 그 외면 `{ is_published:true, published_at: now }` 를 돌려준다.
- **발행 플랜** DB 체크 `legal_document_versions_published_at`(발행이면 `published_at` 필수)와 짝을 이룬다.

## 1.4 임시저장 삭제 (`deleteLegalDraftAction`)

폼에는 버튼이 없지만 같은 모듈에 존재하는 액션이다(직접 POST 로도 불릴 수 있어 서버에서 다시 막는다).

| 항목 | 내용 |
|---|---|
| 검증 | `isLegalSlug(slug)` + `id` 비어 있지 않을 것 |
| 거절 | 발행본이면 삭제 불가 |
| DB | `legal_document_versions` 하드 삭제 |
| 감사 | `legal.delete_draft` |
| 캐시 | 관리자 경로만 재검증 |
| 이동 | `redirect('/legal/{slug}')` |

**동작 상세**

- **거절** 개정 이력이 곧 법적 근거이기 때문에 발행본은 지울 수 없다.
- **감사** before 는 `{ slug, version, effectiveDate, isPublished:'false' }` 다.
- **캐시** `/legal` 과 `/legal/{slug}` 만 재검증하고 사용자 태그는 태우지 않는다 — 임시저장은 독자에게 보인 적이 없다.

**클라이언트와의 상호작용**

- `발행`으로 저장하면 태그 `legal` 재검증으로 사용자 사이트 `/policy/[slug]` 가 즉시 새 문안을 읽는다(재검증 실패 시 최대 300초 지연).
- `예약`으로 저장하면 태그는 태우지만 `current_legal_version()` 이 아직 그 버전을 고르지 않으므로 화면은 그대로다.
- 예약본은 시행일이 되는 순간 자동으로 바뀌며 그때는 아무도 버튼을 누르지 않는다. 캐시 수명(300초) 안에서는 최대 5분 늦게 바뀐다.
- `임시저장`은 사용자 화면 변화가 없다. RLS `legal_versions_select_published` 가 anon 에게 발행본만 연다.
- 반대로 예약본은 anon 도 조회할 수 있다 — 개정 예고는 법령상 사전 공지 대상이라 감추는 쪽이 문제가 되기 때문이다(마이그레이션 주석).
- 발행본이 처음 생기는 순간 사용자 화면이 코드 문안(`POLICY_FALLBACKS`) 대신 DB 문안으로 바뀐다. 버전 알약·시행일 표기도 함께 바뀐다.
- 지식재산권 고지는 이 본문이 아니라 `site_settings.ip_notice` 가 단일 출처다(→ `10-settings/01-basic-info.md`). 개정 이력에 끌려 들어가면 문구 하나 고치려고 약관 개정본을 만들어야 하기 때문이다.

**오류·예외**

- 슬러그 이상: "알 수 없는 문서입니다."
- 버전 형식: "버전은 YYYYMMDD 형식입니다(같은 날 재개정은 20260909-2)."
- 버전 중복(23505 → `duplicateMessage`): "이미 있는 버전 번호입니다."
- 시행일 형식: "시행일을 올바르게 입력해 주세요."
- 예약인데 시행일이 오늘 이하: "예약하려면 시행일이 오늘보다 뒤여야 합니다."
- 발행인데 시행일이 미래: "시행일이 미래입니다. 예약을 선택해 주세요."
- 요약 길이: "변경 요약은 200자를 넘을 수 없습니다."
- 본문 누락: "본문을 입력해 주세요."
- 정제 후 본문이 빔(`content` 필드): "저장할 수 있는 본문이 없습니다."
- 발행 상태 값 이상: "발행 상태를 선택해 주세요."
- 발행본 수정 시도: "이미 발행한 개정본은 고칠 수 없습니다. 새 버전을 만들어 주세요."
- 대상 없음: "개정본을 찾을 수 없습니다."
- 저장 실패 공통(`SAVE_FAILURE`): "저장하지 못했습니다. 잠시 후 다시 시도해 주세요."
- 삭제 요청 이상: "알 수 없는 요청입니다."
- 발행본 삭제 시도: "발행한 개정본은 삭제할 수 없습니다."
- 삭제 실패: "삭제하지 못했습니다. 잠시 후 다시 시도해 주세요."
- 발행본 수정 차단은 화면(`fieldset disabled`)과 액션 양쪽에서 걸린다. 화면만 막으면 직접 POST 로 통과한다.
- 저장 성공 시 토스트가 뜨지 않는다. `redirect` 가 흐름을 끊어 `state.message` 가 화면에 남지 않으며, 이동한 URL 의 `?version=` 이 방금 저장한 개정본을 가리키는 것이 성공 신호다.
- 동시 편집 보호가 없다. 두 운영자가 같은 초안을 고치면 나중 저장이 이긴다(발행본은 애초에 잠겨 있어 이 문제가 없다).
