# 가이드(확률형 아이템) — 화면·기능 설명

> 관리자 콘솔(`admin/`)의 가이드 메뉴. 경로 · 권한 · 화면 구성 · 동작(서버 액션) · 클라이언트(사용자 사이트)와의 상호작용을 개발 참고용으로 정리한다.
> 작성 규칙: 코드에서 확인한 사실만 쓴다. 파일 경로는 저장소 루트 기준. 워딩은 "카테고리"(말머리 금지).

## 0. 한눈에

| 항목 | 값 |
|---|---|
| 경로 | `/gacha` (하위: `/gacha/new`, `/gacha/[id]`) |
| 권한 모듈 | `gacha` — read / write (`admin/lib/auth/permissions.ts`) |
| 주요 테이블 | `gacha_items` |
| 클라이언트 영향 | 캐시 태그 `gacha` 재검증 → 사용자 사이트 `/guide` 즉시 반영(단 `NEXT_PUBLIC_FEATURE_GUIDE_COMING_SOON=true`면 사용자 사이트는 DB 조회 자체를 건너뛰고 "서비스 준비 중" 카드만 그린다 — 관리자 데이터와 무관) |
| 관련 파일 | `admin/app/(admin)/gacha/{page,new/page,[id]/page}.tsx`, `admin/components/gacha/*`, `admin/lib/{actions,data,validation}/gacha*.ts` |

## 1. 목록 (`/gacha`)

**목적** 탭(프리미엄 부화기 · 큐브/등급업 · 주문서 부화기)별 확률형 아이템 공시를 조회·검색·삭제한다.

**화면 구성**
- 탭(`GachaToolbar`): `GACHA_TABS`(`premium`·`cube`·`scroll`). 기본 탭은 프리미엄.
- 검색: 이름 GET 폼(`q`).
- 표 열: 아이콘, 이름(확률표 N행 표시), 확률 %(소수 3자리), 공개 뱃지, 게시일, 수정일. 쓰기 권한자에게만 수정/삭제 열이 붙는다.
- 정렬 가능 컬럼: `name`·`probability`·`published_at`(기본 desc)·`updated_at`. 페이지 크기 20건(`DEFAULT_PAGE_SIZE`).
- 버튼: 새 아이템(쓰기 권한만) → `/gacha/new?tab=`.

**동작(서버 액션)**
| 동작 | 액션 함수 | 검증 | DB 변경 | 감사 로그 | 클라이언트 영향 |
|---|---|---|---|---|---|
| 삭제 | `deleteGachaItemAction` (`admin/lib/actions/gacha-actions.ts`) | `id` 존재 확인만 | `gacha_items` delete | `gacha.delete` | 태그 `gacha` 재검증 |

**클라이언트와의 상호작용**
- 사용자 사이트 `/guide`(`app/(public)/guide/page.tsx`)는 `is_published=true`인 `gacha_items`만 `unstable_cache`(60초, 태그 `gacha`)로 읽는다(`lib/data/gacha.ts`).
- `FEATURES.guideOpen`(`NEXT_PUBLIC_FEATURE_GUIDE_COMING_SOON !== 'true'`, `lib/constants/features.ts`)이 꺼져 있으면 `/guide`는 Supabase 조회 자체를 하지 않고 준비 중 카드만 그린다 — 관리자에서 공개해도 이 플래그가 켜져 있으면 사용자에게 보이지 않는다.

**주의**
- 확률형 아이템은 공시 자료라 삭제는 소프트 삭제가 아니다(되돌릴 수 없음). 잠시 내리려면 발행을 해제한다.
- `rows`(확률표)는 jsonb라 검증에 실패한 행은 빈 배열로 떨어진다(깨진 데이터가 목록 전체를 죽이지 않게 하는 방어).

## 2. 새 아이템 (`/gacha/new`)

**목적** 확률형 아이템을 새로 등록한다.

**화면 구성**(`GachaForm`, 등록·수정 공용)
- 탭, 이름(최대 120자), 대표 확률(0~100, 소수 3자리), 게시일(`datetime-local`, KST, 비우면 저장 시각), 아이콘 주소 또는 아이콘 파일 업로드(png/jpg/webp/gif/svg), 공개 체크박스(기본 체크).
- 확률표 편집기(`GachaRowsEditor`): 등급(SS/S/A/B/C)·아이템명(최대 100자)·아이콘 주소·확률·비고(최대 200자) 행을 자유롭게 추가/삭제. JSON 하나로 폼에 실린다.
- 저장 전 미리보기(`GachaPreview`): 사용자 사이트 카드와 같은 형태로 렌더링.

**동작(서버 액션)**
| 동작 | 액션 함수 | 검증 | DB 변경 | 감사 로그 | 클라이언트 영향 |
|---|---|---|---|---|---|
| 등록 | `saveGachaItemAction` (`admin/lib/actions/gacha-actions.ts`), `id`가 빈 값이면 생성 | zod `gachaItemSchema` + `gachaRowsJsonSchema`(`admin/lib/validation/gacha.ts`) | `gacha_items` insert | `gacha.create` | `revalidatePath('/gacha')` + 태그 `gacha` 재검증 |

**클라이언트와의 상호작용**
- 저장 즉시(공개 상태라면) `/guide` 목록·상세에 나간다. 확률 공시는 법적 고지라 캐시가 늦게 비워지지 않도록 저장 성공 직후 재검증한다.

**주의**
- 아이콘 파일은 매번 새 UUID 경로(`gacha/<uuid>.<ext>`)로 올린다 — 같은 파일명이 다른 아이템의 아이콘을 덮어써 조용히 바뀌는 사고를 막는다.
- 아이콘 주소를 비우면 사용자 사이트는 확률표 첫 행의 아이콘으로 대신한다.

## 3. 수정 (`/gacha/[id]`)

**목적** 등록된 아이템을 수정한다. 화면·검증·동작은 §2와 완전히 같다(`id`가 채워진 채로 `saveGachaItemAction` 호출).

**동작(서버 액션)**
| 동작 | 액션 함수 | 검증 | DB 변경 | 감사 로그 | 클라이언트 영향 |
|---|---|---|---|---|---|
| 수정 | `saveGachaItemAction`, `id` 존재 | zod `gachaItemSchema` | `gacha_items` update | `gacha.update` | `revalidatePath('/gacha')` + 태그 `gacha` 재검증 |

**주의**
- 이전 값(`before`)을 수정 전에 먼저 읽어 감사 로그의 `before`/`after`에 함께 남긴다.
- 존재하지 않는 `id`는 `notFound()`로 404 처리한다.
