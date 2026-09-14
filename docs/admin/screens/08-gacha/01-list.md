# 가이드 — 목록 (`/gacha`)

**목적** 탭(카테고리)별 확률형 아이템 공시를 이름으로 검색하고, 공개 여부·대표 확률·게시일을 한눈에 확인해 수정·삭제로 들어가는 화면. 운영자가 가이드 메뉴를 열면 가장 먼저 보는 화면이다.

**데이터 출처** `getGachaList({ tab, q, sort, page })`(`admin/lib/data/gacha.ts`)가 세션 클라이언트로 `gacha_items` 를 읽는다.

- 질의: `select(…, { count:'exact' })` → `.eq('tab', tab)` → 검색어가 있으면 `.ilike('name', '%q%')`.
- 정렬: `.order(sort.key, …)` 다음에 `.order('id', asc)` 로 동률을 확정한다.
- 페이지 크기 `DEFAULT_PAGE_SIZE` = 20, 기본 정렬 `DEFAULT_GACHA_SORT` = `published_at desc`.
- 비공개 항목도 함께 읽는다(RLS `gacha_items_admin_all`).
- 조회 실패 시 예외를 던지지 않고 `console.error('[gacha] 목록 조회 실패')` 후 빈 표 · 0건으로 그린다.
- `rows`(jsonb)는 `gachaRowsSchema.safeParse` 로 걸러 실패하면 빈 배열로 떨어뜨린다 — 깨진 행 하나가 목록 전체를 죽이지 않게 하려는 방어다.

## 1.0 URL 파라미터

화면 상태는 전부 쿼리스트링이다(`admin/lib/utils/table-query.ts`). 표 자체는 상태를 갖지 않아 새로고침·뒤로가기·링크 공유가 같은 화면을 재현한다.

| 파라미터 | 파싱 함수 | 잘못된 값 |
|---|---|---|
| `?tab=` | `isGachaTab(raw)` | `premium`(`DEFAULT_GACHA_TAB`) |
| `?q=` | `firstValue()` | 빈 값 = 전체 |
| `?sort=` | `parseSort(raw, GACHA_SORT_KEYS, DEFAULT_GACHA_SORT)` | 기본 정렬 |
| `?page=` | `parsePage()` | 1 |

**동작 상세**

- **`?tab=`** 질의 조건 `.eq('tab', tab)` 이 된다.
- **`?q=`** 서버에서 `%`·`_` 를 `\` 로 이스케이프한 뒤 `ilike('name', '%q%')` 에 넣는다.
- **`?sort=`** 형식은 `키:방향`. 허용 키는 `name`·`probability`·`published_at`·`updated_at` 이고, 방향은 `asc` 가 아니면 전부 `desc` 로 본다.
- **`?page=`** 1 이상 정수만 받고 `pageRange(page, 20)` → `.range(from, to)` 로 넘어간다.
- **공통** 같은 키가 여러 번 오면 `firstValue()` 가 첫 값만 쓴다.

## 1.1 탭 · 검색 툴바 (`GachaToolbar`)

서버 컴포넌트다. 탭은 `<Link>`, 검색은 GET `<form action="/gacha">` 라 자바스크립트 없이도 목록이 움직이고 뒤로가기가 그대로 살아난다.

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값 | 동작 / 상호작용 |
|---|---|---|---|---|
| 탭 3개 | 링크(`GACHA_TABS`) | DB enum `gacha_tab` 과 같은 값 | `premium` | 탭 전환(아래 상세) |
| 아이템 이름 검색 | 텍스트(search) | `maxLength = SEARCH_MAX_LENGTH`(60) | 현재 `q` | `?tab=…&q=…` 로 제출 |
| 검색 | 제출 버튼 | — | — | GET 이라 URL 이 곧 상태 |
| 새 아이템 | 버튼(링크) | write 권한자에게만 | — | `/gacha/new?tab=<현재탭>` |

**동작 상세**

- **탭 3개** `buildHref('/gacha', { q }, { tab })` 로 이동한다. 검색어만 유지하고 정렬·페이지는 버린다 — 다른 탭의 페이지 번호는 뜻이 없기 때문이다.
- **탭 3개** 활성 탭에는 `aria-current="page"` 와 밑줄 강조가 붙는다.
- **아이템 이름 검색** zod 스키마가 없다. 서버가 `%`·`_` 를 이스케이프해 ilike 와일드카드 오염만 막는다.
- **아이템 이름 검색** 라벨 옆에 `현재/60` 글자수가 표시된다(`countPlacement="label"`). 비우고 제출하면 전체 목록이다.
- **검색** 정렬·페이지 파라미터는 폼에 실리지 않아 제출할 때마다 초기화된다.
- **새 아이템** 보던 탭이 등록 폼의 기본 탭이 된다.

## 1.2 목록 표 (`Table`)

카드 머리는 `${gachaTabLabel(tab)} ${count}건` 이고, 검색 중이면 `"<q>" 검색 결과` 가 덧붙는다. 빈 목록 문구는 `등록된 아이템이 없습니다.` 다.

| 열 | 값의 출처 | 정렬 키 | 표시 규칙 |
|---|---|---|---|
| 아이콘 | `icon_url` | — | 32×32 썸네일(`ItemIcon`) |
| 이름 | `name` | `name` | 굵게 + 아래 `확률표 {rows.length}행` |
| 확률 % | `probability` | `probability` | `toFixed(3)`, 우측 정렬 |
| 공개 | `is_published` | — | 뱃지 2종 |
| 게시일 | `published_at` | `published_at` | `formatDateTime`(KST) |
| 수정일 | `updated_at` | `updated_at` | `formatDateTime`(KST) |
| 조치 | — | — | `수정` + `삭제`(write 권한만) |

**동작 상세**

- **아이콘** `siteAssetSrc(url)` 로 그린다. `/` 로 시작하는 값에는 사용자 사이트 주소(`NEXT_PUBLIC_CLIENT_SITE_URL`)를 앞에 붙인다 — 관리자 앱에는 그 파일이 없기 때문이다. 값이 없으면 회색 자리 상자가 나온다.
- **이름** 확률표 행 수는 파싱에 성공한 행만 센다.
- **확률 %** 목록은 셋째 자리까지, 사용자 사이트 카드는 둘째 자리(`toProbabilityText`)라 값이 달라 보일 수 있다.
- **조치** write 권한자에게만 열 자체가 생긴다. `수정` 은 `/gacha/[id]`, `삭제` 는 확인 다이얼로그(→ [03-delete-dialog.md](03-delete-dialog.md))다.
- **정렬 링크** `sortHref()` 가 만든다. 같은 키를 다시 누르면 `desc → asc` 로 뒤집고, 정렬이 바뀌면 `page` 를 지워 1페이지로 돌아간다.

## 1.3 페이지네이션

| 컨트롤 | 종류 | 제한 | 기본값 | 동작 |
|---|---|---|---|---|
| 페이지 번호 | 링크 | `totalPages(count, 20)` | 1 | 탭·검색어·정렬 유지 |

- **페이지 번호** `buildHref('/gacha', searchParams, { page })` 로 `page` 만 바꾼다.

**상태·뱃지 의미**

| 값 | 라벨 | 색 | 언제 |
|---|---|---|---|
| `is_published = true` | 공개 | success(초록) | 사용자 사이트 질의에 포함된다 |
| `is_published = false` | 비공개 | neutral(회색) | 관리자에게만 보인다 |

- **공개** 사용자 사이트 질의 조건은 `.eq('is_published', true)` 다.
- **비공개** 잠시 내릴 때 쓰는 상태다. 삭제와 달리 되돌릴 수 있다.

**클라이언트와의 상호작용**

- 사용자 사이트 `/guide`(`app/(public)/guide/page.tsx` → `lib/data/gacha.ts`)는 같은 테이블에서 `is_published = true` 인 행만 읽는다.
- 목록은 15건씩(`GACHA_PAGE_SIZE`) 누적 더보기이고, 정렬은 `latest`(공시일 역순, 기본)·`prob_desc`·`prob_asc` 세 가지다. 관리자의 정렬 기준(`name`·`updated_at`)과는 다른 축이다.
- 이 화면의 "게시일"이 사용자 카드의 갱신일로 찍힌다(`toGachaItem`: `updatedAt: row.published_at`). `updated_at` 은 사용자 사이트에 나가지 않는다.
- `FEATURES.guideOpen`(`NEXT_PUBLIC_FEATURE_GUIDE_COMING_SOON !== 'true'`, `lib/constants/features.ts`)이 꺼져 있으면 `/guide` 는 조회 자체를 건너뛰고 `ComingSoon` 카드만 그리며 메타데이터에 `robots: { index:false, follow:false }` 가 붙는다. 플래그가 공개 여부보다 우선하므로 관리자에서 공개해도 보이지 않는다.

**오류·예외**

- 조회 실패는 배너 없이 빈 표로 떨어진다(원인은 서버 로그 `[gacha] 목록 조회 실패`). "정말 0건"인지 "조회가 깨졌는지"는 화면에서 구분할 수 없다.
- `?sort=` 에 허용 키 밖의 값이 오면 조용히 기본 정렬로 떨어진다.
- 읽기 전용 관리자는 조치 열과 `새 아이템` 버튼이 아예 그려지지 않는다.
- 그 상태에서 `/gacha/new` 나 `/gacha/[id]` 로 직접 접근하면 `requirePermission('gacha','write')` 가 `/?error=forbidden` 으로 되돌린다.
