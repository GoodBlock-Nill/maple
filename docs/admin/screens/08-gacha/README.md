# 가이드(확률형 아이템) — 메뉴 개요

> 관리자 콘솔(`admin/`)의 가이드 메뉴. 화면 하나당 파일 하나이며, 각 파일은 `_TEMPLATE.md` 형식(목적 · 데이터 출처 · 섹션별 필드 표 · 상태·뱃지 · 클라이언트 상호작용 · 오류·예외)을 따른다.
> 작성 규칙: 코드에서 확인한 사실만 쓴다(파일·함수·스키마 이름 그대로). 경로는 저장소 루트 기준. 워딩은 "카테고리".

## 0. 한눈에

| 항목 | 값 |
|---|---|
| 경로 | `/gacha` (하위: `/gacha/new`, `/gacha/[id]`) |
| 권한 모듈 | `gacha` — read / write (`admin/lib/auth/permissions.ts`). read 는 목록·표만 본다. write 면 목록에 조치 열(수정·삭제)이 붙고 `새 아이템` 버튼이 보이며, 사이드바에 `새 아이템` 하위 메뉴가 생긴다(`admin/lib/nav.ts`, `level: 'write'`) |
| 주요 테이블 | `gacha_items`(`id`·`tab`·`name`·`icon_url`·`probability numeric(6,3)`·`rows jsonb`·`published_at`·`is_published`·`created_at`·`updated_at`) |
| 클라이언트 영향 | 캐시 태그 `gacha` 재검증 → 사용자 사이트 `/guide` 목록·상세 모달. 단 `FEATURES.guideOpen` 이 꺼져 있으면 `/guide` 는 조회 자체를 건너뛰고 준비 중 카드만 그린다(플래그 우선) |
| 관련 파일 | 페이지 `admin/app/(admin)/gacha/{page,new/page,[id]/page}.tsx` · 컴포넌트 `admin/components/gacha/{GachaToolbar,GachaForm,GachaRowsEditor,GachaPreview,DeleteGachaButton}.tsx` · 액션 `admin/lib/actions/gacha-actions.ts` · 데이터 `admin/lib/data/gacha.ts` · 검증 `admin/lib/validation/gacha.ts` · 업로드 `admin/lib/actions/asset-upload.ts` · 마이그레이션 `supabase/migrations/20260908000500_site_content.sql` · 클라이언트 `app/(public)/guide/page.tsx`, `lib/data/gacha.ts`, `lib/data/mappers.ts`, `lib/constants/guide.ts` |

## 1. 화면 목록

| # | 문서 | 경로 | 한 줄 |
|---|---|---|---|
| 01 | [01-list.md](01-list.md) | `/gacha` | 탭·검색·정렬·페이지로 공시 목록을 훑고 수정/삭제로 들어간다 |
| 02 | [02-form.md](02-form.md) | `/gacha/new`, `/gacha/[id]` | 등록·수정 공용 폼(`GachaForm`). 기본 정보 · 확률표 편집기 · 사용자 사이트 미리보기 |
| 03 | [03-delete-dialog.md](03-delete-dialog.md) | `/gacha` 행 조치 | 삭제 확인 다이얼로그(하드 삭제) |

## 2. 메뉴 전체 규칙

- **탭(카테고리)** `GACHA_TABS` = `premium`(프리미엄 부화기) · `cube`(큐브 / 등급업) · `scroll`(주문서 부화기). DB enum `gacha_tab` 과 `satisfies` 로 묶여 있고, 라벨은 사용자 사이트 `lib/constants/guide.ts` 의 `GACHA_TABS` 와 글자까지 같다. 기본 탭 `DEFAULT_GACHA_TAB = 'premium'`.
- **권한 재확인** 페이지는 `requirePermission('gacha', 'read'|'write')`, 모든 서버 액션은 스스로 `requirePermission('gacha','write')` 를 호출한다(UI 를 거치지 않는 직접 POST 방어). 권한 없으면 `/?error=forbidden` 으로 되돌린다.
- **캐시** 쓰기 액션은 `revalidatePath('/gacha')` + `revalidateClient([CLIENT_CACHE_TAGS.gacha])`(→ 사용자 사이트 `POST /api/revalidate`, 헤더 `x-revalidate-secret`, 5초 타임아웃, 실패해도 저장은 되돌리지 않고 경고 로그만).
- **캐시 실패 시 지연** 사용자 사이트는 `unstable_cache(…, { tags:['gacha'], revalidate: LIST_REVALIDATE_SECONDS })` = 60초. 태그 호출이 실패하면 최대 60초 늦게 반영된다.
- **감사 로그** `gacha.create` / `gacha.update` / `gacha.delete`, `target_table = 'gacha_items'`. 감사 화면 라벨은 "확률형 아이템 등록 / 수정 / 삭제"(`DOMAIN_LABELS.gacha` + `VERB_LABELS`), 대상 링크는 `/gacha/[id]`(`auditTargetHref`).
- **확률 합계 검증은 없다.** 대표 확률은 0~100 범위만 보고, 확률표 각 행의 확률은 "숫자 표기인지"만 본다. 행 합계가 100 이 아니어도 저장된다(`gachaRowSchema` 주석: 합계 검증이 필요해질 수 있어 반올림하지 않는다).
- **모든 화면이 `dynamic = 'force-dynamic'`** — 공개 전환·삭제 직후 옛 목록이 보이면 같은 조작이 반복되기 때문이다. `/gacha/new` 는 게시일 기본값이 "지금"이라 정적으로 굳힐 수 없다.
