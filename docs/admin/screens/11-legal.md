# Legal — 화면·기능 설명

> 관리자 콘솔(`admin/`)의 Legal 메뉴. 경로 · 권한 · 화면 구성 · 동작(서버 액션) · 클라이언트(사용자 사이트)와의 상호작용을 개발 참고용으로 정리한다.
> 작성 규칙: 코드에서 확인한 사실만 쓴다. 파일 경로는 저장소 루트 기준. 워딩은 "카테고리"(말머리 금지).

## 0. 한눈에

| 항목 | 값 |
|---|---|
| 경로 | `/legal` (하위: `/legal/[slug]`) |
| 권한 모듈 | `legal` — read / write (`admin/lib/auth/permissions.ts`) |
| 주요 테이블 | `legal_documents`, `legal_document_versions` |
| 클라이언트 영향 | 캐시 태그 `legal` 재검증(발행·예약 저장일 때만) → 사용자 사이트 `/policy/[slug]` 반영 |
| 관련 파일 | `admin/app/(admin)/legal/{page,[slug]/page}.tsx`, `admin/components/legal/*`, `admin/lib/{actions,data,validation}/legal.ts`, `admin/lib/constants/legal.ts` |

## 1. 문서 목록 (`/legal`)

**목적** 문서 4종(개인정보처리방침 · 디스코드 운영정책 · 글자월드 운영정책 · 마케팅 정보 수신 동의, `LEGAL_DOCUMENTS`)의 발행 현황을 카드로 보여준다. 문서 수가 고정이라 표·검색·페이지가 없다.

**화면 구성**
- 카드마다: 상태 뱃지(미발행 / `LEGAL_STATUS_LABEL` — 임시저장·예약·시행 중·지난 버전), 현재 발행 버전, 시행일, 마지막 수정(가장 최근에 만든 개정본 기준), 개정본 건수.
- 버튼: [쓰기 권한만] 편집 · 버전 이력(`#history` 앵커), 클라이언트에서 보기(`/policy/[slug]` 새 창).

**동작(서버 액션)**
이 화면 자체에는 쓰기 액션이 없다(카드 목록뿐).

**클라이언트와의 상호작용**
- 사용자 사이트 `/policy/[slug]`(`app/(public)/policy/[slug]/page.tsx` → `lib/data/legal.ts`)는 DB 함수 `current_legal_version(slug)`로 "지금 시행 중인 문안"을 읽는다(`unstable_cache` 300초, 태그 `legal`).
- 발행본이 하나도 없으면 코드 안의 문안(`lib/content/policy-fallback.ts`)으로 폴백한다 — 약관 페이지는 DB 상태와 무관하게 항상 열려 있어야 하기 때문이다.

**주의**
- 문서 행이 아직 없어도(시드 전) 편집 화면은 저장 시점에 자동으로 만든다(`ensureDocumentId`).

## 2. 문서 편집 (`/legal/[slug]`)

**목적** 개정본을 작성·발행·예약하고, 과거 버전을 비교한다. 슬러그가 `LEGAL_SLUGS`(`privacy`·`discord`·`operating`·`marketing`) 밖이면 404.

**화면 구성**
- 상단: 상태 뱃지 + "클라이언트에서 보기" 링크. 발행본이 없으면 "저장하면 사용자 사이트가 코드 문안 대신 이 문안을 읽습니다" 안내.
- 편집 폼(`LegalForm`): 변경 요약(사용자 사이트 비노출, 이력 확인용, 200자), 본문 리치 에디터(`LegalEditor`, H2가 사용자 사이트 목차 항목이 된다), 발행 설정(`LegalPublishFields`): 버전(`YYYYMMDD` 또는 `YYYYMMDD-N`), 시행일, 발행 모드(임시저장 / 발행 / 예약).
- **이미 발행한 개정본을 열면 폼이 잠긴다**(저장 버튼 비활성) — "새 초안 만들기"로만 이어갈 수 있다.
- 저장 전 미리보기(`LegalPreview`): 사용자 사이트와 같은 포맷.
- 버전 비교(`LegalDiffView`): `?base=`로 지정한 버전과 현재 열람 중인 버전의 HTML을 비교(지정했을 때만 표시).
- 버전 이력(`LegalVersionHistory`, `#history`): 버전 · 시행일 · 상태 · 변경 요약 · 만든 날짜 + [보기 / 새 초안 만들기 / 비교] 버튼, "빈 초안 만들기".

**동작(서버 액션)**
| 동작 | 액션 함수 | 검증 | DB 변경 | 감사 로그 | 클라이언트 영향 |
|---|---|---|---|---|---|
| 개정본 저장 | `saveLegalVersionAction` (`admin/lib/actions/legal-actions.ts`), `id` 빈 값이면 생성 | zod `legalFormSchema`(`admin/lib/validation/legal.ts`) + `sanitizeLegalHtml` | `legal_document_versions` insert/update | `legal.create` / `legal.update` / `legal.publish`(발행·예약 시) | 발행·예약 저장일 때만 태그 `legal` 재검증 |
| 임시저장 삭제 | `deleteLegalDraftAction` | 슬러그·`id` 존재, 발행본 아님 | `legal_document_versions` delete | `legal.delete_draft` | 없음(임시저장은 사용자에게 보인 적 없음) |

**클라이언트와의 상호작용**
- "지금 시행 중인 개정본" 판정 규칙(`selectCurrentLegalVersion`, `admin/lib/validation/legal.ts`)은 DB `current_legal_version()`과 **완전히 같은 규칙**이어야 한다 — 규칙이 갈리면 예약 개정본이 걸린 날 관리자 미리보기와 사용자 화면이 서로 다른 버전을 보여준다: 발행본 중 시행일이 오늘 이하인 것이 있으면 시행일이 가장 늦은 것, 없으면 가장 최근에 발행한 것.

**주의**
- **발행본은 절대 수정하지 않는다.** 이미 발행한 개정본을 저장하려 하면 "이미 발행한 개정본은 고칠 수 없습니다"로 막고, 항상 새 버전을 쌓는다 — 분쟁 시점의 문안을 되짚을 수 있어야 하기 때문이다.
- 예약(`schedule`)은 시행일이 오늘보다 뒤여야 하고, 즉시 발행(`publish`)은 시행일이 오늘 이하여야 한다(`legalFormSchema`의 `superRefine`).
- 버전 번호는 유니크 제약이 있다(`unique_version`) — 중복 저장 시 "이미 있는 버전 번호입니다" 안내.
- 본문은 `sanitizeLegalHtml`로 정제한 뒤 빈 문자열이면 저장을 거부한다(허용되지 않은 태그만 보낸 경우).
- 지식재산권 고지 문구는 약관 개정 이력이 아니라 사이트 설정(`site_settings.ip_notice`)이 단일 출처다(`10-settings.md` 참고) — 그쪽을 고치면 즉시 반영되고, 약관 개정본을 새로 만들 필요가 없다.
- 인증·권한 배경 지식은 `admin/README.md` §4를 참고(이 문서는 재서술하지 않는다).
