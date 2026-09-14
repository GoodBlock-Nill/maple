# 가이드 — 목록 (`/gacha`)

**목적** 탭(카테고리)별 확률형 아이템 공시를 이름으로 검색하고, 공개 여부·대표 확률·게시일을 한눈에 확인해 수정·삭제로 들어가는 화면. 운영자가 가이드 메뉴를 열면 가장 먼저 보는 화면이다.

**데이터 출처** `getGachaList({ tab, q, sort, page })`(`admin/lib/data/gacha.ts`) — 세션 클라이언트로 `gacha_items` 를 `select(id, tab, name, icon_url, probability, is_published, published_at, updated_at, rows, { count:'exact' })` → `.eq('tab', tab)` → (검색어 있으면) `.ilike('name', %q%)` → `.order(sort.key, …).order('id', asc)` → `.range()`. 페이지 크기 `DEFAULT_PAGE_SIZE` = 20, 기본 정렬 `DEFAULT_GACHA_SORT` = `published_at desc`. 비공개 항목도 함께 읽는다(RLS `gacha_items_admin_all`). 조회 실패 시 예외를 던지지 않고 `console.error('[gacha] 목록 조회 실패')` 후 **빈 표 + 0건**으로 그린다(배너 없음 — 화면상 "등록된 아이템이 없습니다."와 구분되지 않는다). `rows`(jsonb)는 `gachaRowsSchema.safeParse` 로 걸러 실패하면 빈 배열로 떨어뜨린다(깨진 행 하나가 목록 전체를 죽이지 않게).

## 1.1 탭 · 검색 툴바 (`GachaToolbar`)

서버 컴포넌트. 탭은 `<Link>`, 검색은 GET `<form action="/gacha">` 라 자바스크립트 없이도 동작하고 뒤로가기가 그대로 살아난다.

URL 파라미터: `?tab=`(`isGachaTab` 통과 못 하면 `premium`), `?q=`(문자열 그대로), `?sort=<key>:<asc|desc>`(`parseSort`, 허용 키 밖이면 기본값), `?page=`(`parsePage`, 1 미만·숫자 아님 → 1).

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값·프리필 | 동작 / 상호작용 |
|---|---|---|---|---|
| 프리미엄 부화기 / 큐브 · 등급업 / 주문서 부화기 | 탭 링크 3개(`GACHA_TABS`) | 값은 DB enum `gacha_tab` 과 동일 | `premium`(`DEFAULT_GACHA_TAB`) | `buildHref('/gacha', { q }, { tab })` — **검색어만 유지하고 정렬·페이지는 버린다**(다른 탭의 페이지 번호는 뜻이 없다). 활성 탭에 `aria-current="page"` + 밑줄 강조 |
| 아이템 이름 검색 | 텍스트(search) 입력 | `maxLength = SEARCH_MAX_LENGTH`(60). zod 없음 — 서버에서 `%`·`_` 를 이스케이프해 ilike 와일드카드 오염만 막는다 | 현재 `q` | `검색` 제출 → `?tab=<현재탭>&q=…`. 라벨 옆에 `현재/60` 글자수 표시(`countPlacement="label"`). 비우고 제출하면 전체 목록 |
| 검색 | 제출 버튼 | — | — | GET 이라 URL 이 곧 상태. 정렬·페이지 파라미터는 폼에 실리지 않아 초기화된다 |
| 새 아이템 | 버튼(링크) | write 권한자에게만 그린다 | — | `/gacha/new?tab=<현재탭>` — 보던 탭이 등록 폼의 기본 탭이 된다 |

## 1.2 목록 표 (`Table`)

카드 머리: `${gachaTabLabel(tab)} ${count}건` + 검색 중이면 `"<q>" 검색 결과`. 빈 목록 문구 `등록된 아이템이 없습니다.`

| 열 | 종류 | 값의 출처 | 정렬 | 동작 / 상호작용 |
|---|---|---|---|---|
| 아이콘 | 이미지 32×32(`ItemIcon`) | `gacha_items.icon_url` | 불가 | `siteAssetSrc(url)` 로 그린다 — `/` 로 시작하는 값은 사용자 사이트 주소(`NEXT_PUBLIC_CLIENT_SITE_URL`)를 앞에 붙인다(관리자 앱에는 그 파일이 없다). 값이 없으면 회색 자리 상자 |
| 이름 | 텍스트 2줄 | `name` + 아래 `확률표 {rows.length}행` | `name` | 굵게. 확률표 행 수는 파싱에 성공한 행만 센다 |
| 확률 % | 숫자(우측 정렬) | `probability` | `probability` | 항상 `toFixed(3)` — 목록은 셋째 자리까지, 사용자 사이트 카드는 둘째 자리(`toProbabilityText`)라 값이 달라 보일 수 있다 |
| 공개 | 뱃지 | `is_published` | 불가 | `true` → 초록 `공개`, `false` → 회색 `비공개` |
| 게시일 | 일시 | `published_at` | `published_at`(기본, desc) | `formatDateTime`(KST) |
| 수정일 | 일시 | `updated_at` | `updated_at` | `formatDateTime`(KST) |
| 조치 | 버튼 2개 | — | 불가 | **write 권한자에게만 열 자체가 생긴다.** `수정` → `/gacha/[id]`, `삭제` → 확인 다이얼로그(→ [03-delete-dialog.md](03-delete-dialog.md)) |

정렬 링크는 `sortHref()` — 같은 키를 다시 누르면 `desc → asc` 로 뒤집고, 정렬이 바뀌면 `page` 를 지워 1페이지로 돌아간다.

## 1.3 페이지네이션

| 컨트롤 | 종류 | 제한 | 기본값 | 동작 |
|---|---|---|---|---|
| 페이지 번호 | 링크 | `totalPages(count, 20)` | 1 | `buildHref('/gacha', searchParams, { page })` — 탭·검색어·정렬을 모두 유지한 채 `page` 만 바꾼다 |

**상태·뱃지 의미**

| 값 | 라벨 | 색 | 언제 |
|---|---|---|---|
| `is_published = true` | 공개 | success(초록) | 사용자 사이트 `/guide` 질의(`.eq('is_published', true)`)에 포함된다 |
| `is_published = false` | 비공개 | neutral(회색) | 관리자에게만 보인다. 잠시 내릴 때 쓰는 상태 — 삭제와 달리 되돌릴 수 있다 |

**클라이언트와의 상호작용**

- 사용자 사이트 `/guide`(`app/(public)/guide/page.tsx` → `lib/data/gacha.ts`)는 같은 테이블에서 `is_published = true` 인 행만 읽는다. 목록 15건씩(`GACHA_PAGE_SIZE`) 누적 더보기, 정렬은 `latest`(공시일 역순, 기본) · `prob_desc` · `prob_asc` 세 가지이고, 관리자 화면의 정렬 기준(`name`·`updated_at`)과는 다른 축이다.
- 이 화면의 "게시일"이 사용자 카드의 **갱신일**로 찍힌다(`toGachaItem`: `updatedAt: row.published_at`). `updated_at` 은 사용자 사이트에 나가지 않는다.
- `FEATURES.guideOpen`(`NEXT_PUBLIC_FEATURE_GUIDE_COMING_SOON !== 'true'`, `lib/constants/features.ts`)이 꺼져 있으면 `/guide` 는 Supabase 조회 자체를 건너뛰고 `ComingSoon` 카드만 그리며 메타데이터에 `robots: { index:false, follow:false }` 가 붙는다 — **플래그가 공개 여부보다 우선**한다. 관리자에서 아무리 공개해도 보이지 않는다.

**오류·예외**

- 조회 실패는 배너 없이 빈 표로 떨어진다(원인은 서버 로그 `[gacha] 목록 조회 실패`). "정말 0건"인지 "조회가 깨졌는지"는 화면에서 구분할 수 없다.
- `?sort=` 에 허용 키(`name`·`probability`·`published_at`·`updated_at`) 밖의 값이 오면 조용히 기본 정렬로 떨어진다.
- 읽기 전용 관리자는 조치 열·`새 아이템` 버튼이 아예 그려지지 않는다. 그 상태에서 `/gacha/new` 나 `/gacha/[id]` 로 직접 접근하면 `requirePermission('gacha','write')` 가 `/?error=forbidden` 으로 되돌린다.
