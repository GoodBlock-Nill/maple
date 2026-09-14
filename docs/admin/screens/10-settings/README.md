# 사이트 설정 — 메뉴 개요

> 관리자 콘솔(`admin/`)의 사이트 설정 메뉴. 화면 하나당 파일 하나이며, 각 파일은 `_TEMPLATE.md` 형식을 따른다.
> 작성 규칙: 코드에서 확인한 사실만 쓴다. 경로는 저장소 루트 기준. 워딩은 "카테고리".

## 0. 한눈에

| 항목 | 값 |
|---|---|
| 경로 | `/settings` (한 페이지, 독립된 폼 두 벌) |
| 권한 모듈 | `settings` — read / write |
| 주요 테이블 | `site_settings`(단일 행 `id=1`), `hero_banners` |
| 클라이언트 영향 | 캐시 태그 `site` 하나로 두 테이블을 함께 태운다 |
| 소개 화면 플래그 | `FEATURES.aboutDisabled` 기본값이 ON 이다 |

**한눈에 상세**

- **경로** 기본 정보 카드와 히어로 배너 카드가 서로 다른 폼이다.
- **권한** read 는 값과 배너 목록을 그대로 보되 저장 버튼과 배너 조작 버튼이 전부 사라진다(`canWrite` 렌더 분기).
- **권한** write 면 저장·배너 추가/수정/삭제/순서/노출이 열린다.
- **테이블** `site_settings` 는 체크 제약 `site_settings_singleton` 으로 두 번째 행이 막혀 있다.
- **클라이언트** 반영 위치: 전역 푸터(연락처·저작권·IP 고지), `/policy/privacy` 하단, 메타데이터.
- **클라이언트** 이어서: `/play`·`/discord`·`/sns/*` 리다이렉트, `/about` 크리에이터 패널과 상단 영상.

**관련 파일**

- 페이지 `admin/app/(admin)/settings/page.tsx`
- 컴포넌트 `admin/components/settings/{SiteSettingsForm,SiteCreatorFields,wiring}.tsx`
- 컴포넌트 `admin/components/settings/{HeroBannerList,HeroBannerDialog,HeroBannerMediaFields}.tsx`
- 컴포넌트 `admin/components/settings/{BannerActionButton,BannerDeleteButton,site-assets}.tsx|ts`
- 액션 `admin/lib/actions/settings-actions.ts`, 데이터 `admin/lib/data/settings.ts`
- 검증 `admin/lib/validation/settings.ts`, `admin/lib/validation/hero-banner.ts`
- 마이그레이션 `supabase/migrations/20260908000500_site_content.sql`, `20260909000100_hero_banner_media.sql`
- 클라이언트 `lib/data/{site,site-view,hero-banner}.ts`, `lib/constants/site.ts`
- 클라이언트 `components/layout/{SiteFooter,FooterIpNotice,FooterLegalLinks}.tsx`, `components/policy/PolicyDocumentShell.tsx`

## 1. 화면 목록

| # | 문서 | 경로 | 한 줄 |
|---|---|---|---|
| 01 | [01-basic-info.md](01-basic-info.md) | 기본 정보 카드 | 이름·주소·연락처·법적 문구·크리에이터 |
| 02 | [02-hero-banners.md](02-hero-banners.md) | 히어로 배너 카드 | 목록 · 노출 · 순서 · 삭제 |
| 03 | [03-banner-dialog.md](03-banner-dialog.md) | 배너 추가/수정 | 미디어 유형 · 기간 · 정렬 |

## 2. 메뉴 전체 규칙

**미리보기 링크** 페이지 헤더에 `PREVIEW_LINKS` 네 개가 있다 — 홈(`/`), 소개(`/about`), `/play` 리다이렉트, `/discord` 리다이렉트. 모두 `clientSiteUrl()`(`NEXT_PUBLIC_CLIENT_SITE_URL`, 기본 `http://localhost:3000`) 기준 새 창이며 `target="_blank" rel="noreferrer"` 다.

**연동 표시** 기본 정보의 각 필드에는 `WiredField`/`WiringTag`(`admin/components/settings/wiring.tsx`)가 태그를 붙인다. `사이트 반영`(초록) 또는 `미연동`(회색)이고 `title` 툴팁에 노출 위치를 적는다. `SETTINGS_WIRING` 의 11개 필드는 전부 `isLive: true` 다. 표에 없는 필드는 태그가 없고, 배너 카드 제목 옆에는 `사이트 반영` 뱃지가 직접 붙어 있다.

**저장은 upsert(id=1)** `site_settings` 는 두 번째 행이 체크 제약으로 막혀 있어 항상 `upsert({ id: 1, … }, { onConflict:'id' })` 다. 행이 없는 빈 DB 에서는 첫 저장이 곧 초기화이고, 카드 설명이 "아직 설정 행이 없습니다. 저장하면 새로 만듭니다."로 바뀐다.

**캐시** 모든 쓰기 액션이 `revalidatePath('/settings')` 와 `revalidateClient([CLIENT_CACHE_TAGS.site])` 를 부른다. 사용자 사이트 캐시 수명은 `STATIC_REVALIDATE_SECONDS`(300초)라 태그 호출이 실패하면 최대 5분 늦게 반영된다 — 목록 계열(60초)보다 길다.

**폴백** 값이 비었거나 조회가 실패하면 사용자 사이트는 `lib/data/site-view.ts` 의 `orFallback()` 을 거친다. 정적 상수는 `lib/constants/site.ts`(`SITE_NAME`·`CONTACT_EMAIL`·`COPYRIGHT`·`IP_NOTICE`)와 `lib/mock/site.ts`(크리에이터)이며, 공백만 있는 값도 "없음"으로 본다.

**감사 로그**

- **설정** `settings.update` — 대상 `site_settings`, `target_id='1'`.
- **배너** `banner.create`, `banner.update`, `banner.delete` — 대상 `hero_banners`.
- **배너** `banner.toggle`, `banner.reorder` — 대상 `hero_banners`.
- **대상 링크** 두 테이블 모두 `/settings` 로 이어진다.

**소개 화면 비활성화 주의** `FEATURES.aboutDisabled` 는 기본값이 ON 이고, 배포 환경 변수를 리터럴 `'false'` 로 둘 때만 해제된다. 켜져 있으면 사용자 사이트 `proxy.ts` 가 `/about` 과 하위 경로를 302 로 `/` 에 돌려보내며 헤더·드로어·푸터 메뉴에서도 소개 항목이 빠진다. 즉 크리에이터 필드 4개와 히어로 배너는 기본 배포 상태에서 사용자에게 보이지 않는다(관리자 헤더의 "소개" 미리보기 링크도 홈으로 튕긴다).

**렌더링** `dynamic = 'force-dynamic'` 이다.
