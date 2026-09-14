# 사이트 설정 — 화면·기능 설명

> 관리자 콘솔(`admin/`)의 사이트 설정 메뉴. 경로 · 권한 · 화면 구성 · 동작(서버 액션) · 클라이언트(사용자 사이트)와의 상호작용을 개발 참고용으로 정리한다.
> 작성 규칙: 코드에서 확인한 사실만 쓴다. 파일 경로는 저장소 루트 기준. 워딩은 "카테고리"(말머리 금지).

## 0. 한눈에

| 항목 | 값 |
|---|---|
| 경로 | `/settings` |
| 권한 모듈 | `settings` — read / write (`admin/lib/auth/permissions.ts`) |
| 주요 테이블 | `site_settings`(단일 행, `id=1`), `hero_banners` |
| 클라이언트 영향 | 캐시 태그 `site` 재검증 → 사용자 사이트 전역(헤더·푸터·`/about`·`/policy/privacy`·`/play`·`/discord`) 즉시 반영 |
| 관련 파일 | `admin/app/(admin)/settings/page.tsx`, `admin/components/settings/*`, `admin/lib/{actions,data,validation}/settings.ts`, `admin/lib/validation/hero-banner.ts` |

## 1. 사이트 설정 (`/settings`)

**목적** 사용자 사이트 전역에 쓰이는 기본 정보와 소개 화면(`/about`) 상단 히어로 배너를 관리한다.

**화면 구성**
- 미리보기 링크(헤더 action): 홈 · 소개 · `/play` 리다이렉트 · `/discord` 리다이렉트 — 실제 사용자 사이트 새 창.
- 기본 정보 카드(`SiteSettingsForm`): 사이트 이름(필수, 50자), 월드 ID(50자), 디스코드 주소, 유튜브 주소, 연락 이메일, 저작권 문구(200자), 지식재산권 고지(500자, textarea), 크리에이터 이름(6자)·슬로건(40자)·소개(4000자, 문단은 빈 줄 두 개로 구분)·사진(URL 또는 파일 업로드). 필드마다 사용자 사이트 연동 여부 태그("사이트 반영"/"미연동", `admin/components/settings/wiring.tsx`) — 2026-09-09 기준 전부 "사이트 반영"이다.
- 히어로 배너 카드(`HeroBannerList` + `HeroBannerDialog`): 이미지 또는 유튜브 영상 중 하나, 제목·부제(화면 비노출, 관리용/접근성 라벨), 링크(이미지 배너에서만 사용), 버튼 문구(현재 화면 미표시, 예비 필드), 정렬 순서(↑↓ 버튼), 노출 기간(시작/종료, 비우면 무제한), 노출 토글.

**동작(서버 액션)**
| 동작 | 액션 함수 | 검증 | DB 변경 | 감사 로그 | 클라이언트 영향 |
|---|---|---|---|---|---|
| 기본 정보 저장 | `saveSiteSettingsAction` (`admin/lib/actions/settings-actions.ts`) | zod `siteSettingsSchema`(`admin/lib/validation/settings.ts`) | `site_settings` upsert(`id=1`) | `settings.update` | 태그 `site` 재검증 |
| 배너 등록/수정 | `saveHeroBannerAction`, `id` 빈 값이면 생성 | zod `heroBannerSchema`(`admin/lib/validation/hero-banner.ts`) | `hero_banners` insert/update | `banner.create` / `banner.update` | 태그 `site` 재검증 |
| 배너 삭제 | `deleteHeroBannerAction` | `id` 존재 | `hero_banners` delete | `banner.delete` | 태그 `site` 재검증 |
| 배너 노출 토글 | `toggleHeroBannerAction` | - | `hero_banners.is_active` | `banner.toggle` | 태그 `site` 재검증 |
| 배너 순서 변경 | `moveHeroBannerAction` | - | `hero_banners.sort_order`(바뀐 행만) | `banner.reorder` | 태그 `site` 재검증 |

**클라이언트와의 상호작용**
사용자 사이트는 `lib/data/site.ts`가 `site_settings`를 `unstable_cache`(300초, 태그 `site`)로 읽고, `lib/data/site-view.ts`가 화면별 폴백 규칙을 적용한다(값이 비어 있으면 `lib/constants/site.ts`/`lib/mock/site.ts` 정적 상수로 떨어진다).

| 필드 | 사용자 사이트 노출 위치 |
|---|---|
| `gameName` | `app/layout.tsx` 메타데이터(제목·OG) |
| `worldId` | `/play` 리다이렉트 |
| `discordUrl` | `/discord` · `/sns/discord` 리다이렉트 |
| `youtubeUrl` | `/sns/youtube` 리다이렉트. 히어로 배너가 없을 때만 `/about` 상단 영상으로도 쓰인다 |
| `contactEmail` | 홈·전체 푸터 이메일 버튼(`resolveContactEmail`, 표기는 한글 도메인 그대로 · 링크는 ASCII) |
| `copyright` | 푸터 하단 저작권 한 줄(`resolveCopyright`) |
| `ipNotice` | `/policy/privacy` 하단 지식재산권 고지(`resolveIpNotice`) — 약관 개정 이력과 별개로 여기서 바로 바뀐다 |
| `creatorName`·`creatorSlogan`·`creatorIntro`·`creatorPhotoUrl` | `/about` 양피지 패널(`resolveCreator`) |
| `hero_banners` | `/about` 상단 영상 영역. 노출 중(`is_active`) · 기간 내(`starts_at`~`ends_at`) · `sort_order` 오름차순 중 **첫 장만** 걸린다. 배너가 하나도 없으면 위 `youtubeUrl` 영상으로 대체 |

**주의**
- `site_settings`는 체크 제약으로 두 번째 행이 막혀 있어 항상 `upsert(id=1)`이다.
- 이미지 배너는 `imageUrl`(또는 업로드 파일)이 필수, 유튜브 배너는 `videoUrl`에서 영상 id를 뽑을 수 있어야 한다(DB `hero_banners_media_shape` 제약과 동일 규칙을 zod가 먼저 검사).
- 노출 종료 시각은 시작 시각보다 뒤여야 한다(`hero_banners_period` 제약과 동일 규칙).
- 제목·부제·버튼 문구는 화면에 표시되지 않는다 — 실수로 "화면에 안 보인다"고 오조작하지 않도록 폼 힌트에 명시돼 있다.
