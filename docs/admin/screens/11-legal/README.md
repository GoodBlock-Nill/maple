# Legal — 메뉴 개요

> 관리자 콘솔(`admin/`)의 Legal 메뉴. 화면 하나당 파일 하나이며, 각 파일은 `_TEMPLATE.md` 형식을 따른다.
> 작성 규칙: 코드에서 확인한 사실만 쓴다. 경로는 저장소 루트 기준. 워딩은 "카테고리".

## 0. 한눈에

| 항목 | 값 |
|---|---|
| 경로 | `/legal`, `/legal/[slug]`(`#history` 앵커) |
| 권한 모듈 | `legal` — read / write |
| 주요 테이블 | `legal_documents`, `legal_document_versions` |
| 클라이언트 영향 | 발행·예약 저장일 때만 태그 `legal` 재검증 |
| 클라이언트 경로 | 사용자 사이트 `/policy/[slug]` |

**한눈에 상세**

- **권한** 목록은 read 로 열리지만 편집 화면은 `requirePermission('legal','write')` 다.
- **권한** 읽기 전용 관리자는 카드의 `편집`·`버전 이력` 버튼 자체를 보지 못한다.
- **테이블** `legal_documents` 컬럼: `slug`(unique), `title`.
- **테이블** `legal_document_versions` 컬럼: `document_id`, `version`, `effective_date date`, `content_html`.
- **테이블** 이어서: `summary`, `is_published`, `published_at`, `created_by`, `created_at`.
- **클라이언트** 임시저장은 독자에게 보인 적이 없어 캐시를 태우지 않는다.

**관련 파일**

- 페이지 `admin/app/(admin)/legal/{page,[slug]/page}.tsx`
- 컴포넌트 `admin/components/legal/{LegalForm,LegalPublishFields,LegalEditor,LegalToolbar}.tsx`
- 컴포넌트 `admin/components/legal/{LegalPreview,LegalDiffView,LegalVersionHistory}.tsx`
- 컴포넌트 `admin/components/legal/{version-diff,legal-prose}.ts`
- 액션 `admin/lib/actions/legal-actions.ts`, 데이터 `admin/lib/data/legal.ts`
- 검증 `admin/lib/validation/legal.ts`, 상수 `admin/lib/constants/legal.ts`
- 정제 `admin/lib/sanitize/legal-html.ts`
- 마이그레이션 `supabase/migrations/20260908002200_legal_documents.sql`, `20260910000300_legal_marketing.sql`
- 시드 생성기 `scripts/seed-legal.mjs`
- 클라이언트 `app/(public)/policy/[slug]/page.tsx`, `lib/data/legal.ts`
- 클라이언트 `lib/content/policy-fallback.ts`, `components/policy/*`

## 1. 화면 목록

| # | 문서 | 경로 | 한 줄 |
|---|---|---|---|
| 01 | [01-list.md](01-list.md) | `/legal` | 문서 4종의 발행 현황 카드 |
| 02 | [02-document.md](02-document.md) | `/legal/[slug]` | 헤더·미리보기·비교·이력 |
| 03 | [03-version-form.md](03-version-form.md) | 편집 폼 | 요약·본문·발행 설정 |

## 2. 메뉴 전체 규칙

**문서 4종 고정** `LEGAL_SLUGS`·`LEGAL_DOCUMENTS` 가 단일 출처다.

| slug | 라벨 | 사용자 경로 |
|---|---|---|
| `privacy` | 개인정보처리방침 | `/policy/privacy` |
| `discord` | 디스코드 운영정책 | `/policy/discord` |
| `operating` | 글자월드 운영정책 | `/policy/operating` |
| `marketing` | 마케팅 정보 수신 동의 | `/policy/marketing` |

- DB 체크 `legal_documents_slug_known` 이 같은 집합을 강제한다.
- 그 밖의 슬러그로 편집 화면을 열면 `notFound()`(404)다.

**발행본 불변** 이미 발행한(`is_published = true`) 개정본은 문안을 덮어쓸 수 없다. 폼이 통째로 잠기고(`fieldset disabled` + 저장 버튼 비활성), 서버 액션도 "이미 발행한 개정본은 고칠 수 없습니다. 새 버전을 만들어 주세요."로 거절한다. 고치려면 이력에서 `이 버전으로 새 초안 만들기` 를 쓴다 — 분쟁 시점의 문안을 되짚을 수 있어야 하기 때문이다.

**현재 시행본 판정** `selectCurrentLegalVersion(versions, today)`(`admin/lib/validation/legal.ts`)와 DB 함수 `current_legal_version(slug)` 이 같은 규칙이어야 한다. 갈리면 예약 개정본이 걸린 날 관리자 미리보기와 사용자 화면이 다른 버전을 보여 준다.

1. 발행본 중 시행일이 오늘 이하인 것이 있으면 시행일이 가장 늦은 것을 고른다(같으면 나중에 발행한 것).
2. 그런 것이 하나도 없으면(모두 예약) 가장 최근에 발행한 것을 고른다.

**날짜는 KST 달력 날짜** `effective_date` 는 시각 없는 `date` 컬럼이라 UTC 로 해석하면 한국 자정~오전 9시 사이에 하루가 밀린다. `kstToday()`·`formatEffectiveDate()` 가 `new Date()` 를 쓰지 않는 이유다.

**캐시 태그** `LEGAL_CLIENT_CACHE_TAG = 'legal'`(`admin/lib/constants/legal.ts`)이다. 같은 값이 `admin/lib/revalidate.ts` 의 `CLIENT_CACHE_TAGS` 에도 있고, 사용자 사이트가 허용 목록으로 다시 검사하므로 오타는 400 으로 즉시 드러난다. 사용자 캐시 수명은 300초다.

**감사 로그**

| action | 언제 |
|---|---|
| `legal.create` | 새 초안 저장(임시저장) |
| `legal.update` | 기존 초안 저장(임시저장) |
| `legal.publish` | 발행 또는 예약으로 저장 |
| `legal.delete_draft` | 임시저장 삭제 |

- `target_table` 은 `legal_document_versions` 다.
- before/after 는 본문이 아니라 `{ slug, version, effectiveDate, isPublished }` 스냅샷만 남는다. 본문 전문은 감사 로그에 실리지 않는다.
- 감사 화면 라벨은 "약관 등록 / 수정 / 발행"(`DOMAIN_LABELS.legal`)이다.
- 대상 링크는 없다 — `auditTargetHref` 에 `legal_document_versions` 매핑이 없어 ID 만 표시된다.

**시드 재생성** 마이그레이션의 `>>> SEED … <<<` 구간은 `node scripts/seed-legal.mjs` 가 코드 문안(`lib/content/*`)에서 생성한다(손으로 고치지 않는다). `on conflict do nothing` 이라 재실행해도 운영자가 이미 고친 문안을 덮어쓰지 않는다.

**렌더링** 두 화면 모두 `dynamic = 'force-dynamic'` 이다.
