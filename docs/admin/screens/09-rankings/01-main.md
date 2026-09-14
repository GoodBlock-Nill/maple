# 랭킹 — 메인 (`/rankings`)

**목적** 종류(종합·직업·길드)별로 지금 사용자 사이트에 걸려 있는 순위 표를 확인하고, 필요하면 과거 스냅샷을 열어 보거나 그 내용으로 되돌린다. 적재 자체는 이 화면에 없다.

**데이터 출처** 세 함수를 병렬로 읽는다(`admin/lib/data/rankings.ts`, 모두 세션 클라이언트).
- `getRankingSnapshots(rankType)` — `snapshot_at` 만 최신순으로 최대 `SNAPSHOT_SCAN_LIMIT`(5000)행 읽어 **앱에서 직접 센다**(PostgREST 가 group by 를 노출하지 않는다). 실패 시 `console.error('[rankings] 스냅샷 이력 조회 실패')` + 빈 배열.
- `getLatestSnapshotAt(rankType)` — 가장 최근 `snapshot_at` 한 개. 없으면 `null`.
- `getRankingRows(rankType, target)` — `?snapshot=` 값(없으면 최신)의 전체 행을 `rank` 오름차순으로. 실패 시 빈 배열(배너 없음).

URL 파라미터: `?type=`(`isRankType` 통과 못 하면 `total`), `?snapshot=`(ISO 문자열 그대로 비교. 존재하지 않는 값이면 표가 0건으로 그려진다).

## 1.1 종류 탭

| 필드/컨트롤 | 종류 | 필수·제한 | 기본값 | 동작 / 상호작용 |
|---|---|---|---|---|
| 종합 랭킹 / 직업 랭킹 / 길드 랭킹 | 탭 링크 3개(`RANK_TYPES`) | 값은 DB enum `ranking_type` | `total` | `/rankings?type=<value>` — **`snapshot` 파라미터는 이어붙이지 않는다**(다른 종류의 스냅샷 시각은 뜻이 없다). 활성 탭에 `aria-current="page"` |

## 1.2 현재 / 과거 스냅샷 카드

카드 머리가 지금 무엇을 보고 있는지 말한다.

| 필드/컨트롤 | 종류 | 값의 출처 | 동작 / 상호작용 |
|---|---|---|---|
| 카드 제목 | 텍스트 | `target !== latest` 이면 `과거 스냅샷`, 아니면 `현재 스냅샷` | — |
| 사이트에 보이는 표가 아닙니다 | 뱃지(warn) | 위와 같은 판정 | 과거 스냅샷을 열었을 때만. 사용자 사이트는 최신 한 벌만 읽는다는 사실을 그 자리에서 알린다 |
| 카드 설명 | 텍스트 | `formatDateTime(target) · {rows.length}건` | 스냅샷이 하나도 없으면 `아직 적재된 랭킹이 없습니다.` |
| 현재 스냅샷 보기 | 링크(헤더 action) | — | 과거 스냅샷을 볼 때만 노출. `/rankings?type=<type>`(= `snapshot` 파라미터 제거) |

### 표 열

| 열 | 종류 | 값의 출처 | 정렬 | 비고 |
|---|---|---|---|---|
| 순위 | 숫자(우측, w-20) | `rankings.rank` | 항상 `rank` 오름차순(정렬 변경 불가) | 굵게 |
| 캐릭터 | 텍스트 2줄 | `character_name` + 아래 `jobGroupLabel(job_group)` | 불가 | 직업군은 한글 라벨(`모험가`·`시그너스`·`레지스탕스`·`영웅`·`데몬(마족)`) |
| 레벨 | 텍스트(우측, w-24) | `level` | 불가 | `Lv. {level}` 표기 |
| 직업 | 텍스트(w-40) | `job` | 불가 | 자유 문자열 |
| 길드 | 텍스트(w-40) | `guild` | 불가 | `null` 이면 `-` |
| 경험치 | 텍스트(우측, w-32) | `exp` | 불가 | `"98.7B"` 처럼 **축약 문자열 그대로** 보관·표시한다(정렬은 `rank` 로 하므로 숫자형이 필요 없다). `null` 이면 `-` |

표에 없는 컬럼: `avatar_url`·`guild_icon_url`(적재되지만 관리자 표에는 그리지 않는다), `id`, `snapshot_at`. 빈 목록 문구 `표시할 랭킹이 없습니다.`

**페이지네이션 없음** — 스냅샷의 전체 행을 한 번에 그린다(한 스냅샷 100건 안팎을 전제).

## 1.3 스냅샷 이력 (`SnapshotHistory`)

카드 머리 `스냅샷 이력 {N}벌` + 설명 "적재하거나 되돌릴 때마다 새 스냅샷이 쌓이고, 최근 5벌까지 보관합니다."

| 열 | 종류 | 값의 출처 | 동작 / 상호작용 |
|---|---|---|---|
| 스냅샷 시각 | 일시 + 뱃지 | `snapshot_at`(`formatDateTime`) | 최신이면 `현재`(success), 지금 보는 중이면서 최신이 아니면 `보는 중`(accent) |
| 건수 | 숫자(우측, w-24) | 같은 `snapshot_at` 행 수(앱 집계) | — |
| 보기 | 링크 | — | `/rankings?type=<type>&snapshot=<encodeURIComponent(snapshot_at)>` |
| 되돌리기 | 버튼(secondary, sm) | — | **write 권한 + 최신 스냅샷이 아닌 행에만** 그린다 → [02-rollback-dialog.md](02-rollback-dialog.md) |

빈 목록 문구 `아직 적재된 스냅샷이 없습니다.`

**상태·뱃지 의미**

| 뱃지 | 색 | 언제 | 뜻 |
|---|---|---|---|
| 현재 | success | `snapshot_at === latest` | 사용자 사이트가 읽는 바로 그 한 벌 |
| 보는 중 | accent | `snapshot_at === ?snapshot=` 이고 최신이 아님 | 지금 위 표에 그려진 과거 스냅샷 |
| 사이트에 보이는 표가 아닙니다 | warn | 위와 같은 조건(카드 머리) | 이 화면의 표가 사용자 화면과 다르다는 경고 |

**클라이언트와의 상호작용**

- 사용자 사이트 `/ranking`(`app/(public)/ranking/page.tsx` → `lib/data/rankings.ts`)은 `unstable_cache`(60초, 태그 `rankings`)로 **항상 `rank_type='total'` 의 최신 스냅샷만** 모집단으로 쓴다. 직업·길드 스냅샷은 아직 적재되지 않아, 사용자 화면의 세 탭은 같은 모집단을 다르게 좁힌 결과다 — 종합·직업은 전체, 길드는 `guild is not null` 인 캐릭터만(`GUILD_ONLY`).
  → 관리자에서 `?type=job` / `?type=guild` 탭이 비어 있는 것은 정상이며, 사용자 화면의 "직업 랭킹"과 서로 다른 개념이다.
- 사용자 화면은 필터링 후 **순위를 다시 매긴다**(`rank` 오름차순 결과의 인덱스 + 1). 그래서 길드 탭·직업군 필터에서는 관리자 표의 `rank` 값과 화면 번호가 다르다.
- 사용자 화면에만 있는 것: TOP3 카드(`TopThree`, `TOP_RANK_COUNT`), 직업군 칩 필터(`?job=`), 캐릭터명 검색(`?q=`), 10건씩 누적 더보기(`RANKING_PAGE_SIZE`), 캐릭터 이미지(`avatar_url`).
- `FEATURES.rankingOpen`(`NEXT_PUBLIC_FEATURE_RANKING_COMING_SOON !== 'true'`)이 꺼져 있으면 `/ranking` 은 조회 자체를 건너뛰고 `ComingSoon` 카드 + `robots: { index:false, follow:false }` 만 그린다 — **스냅샷 상태와 무관하다.**

**오류·예외**

- 이력 집계는 최근 5000행까지만 훑는다. 한 스냅샷이 매우 크거나 보관 벌 수가 늘면 오래된 스냅샷이 이력에서 조용히 빠질 수 있다(그때는 집계 뷰 또는 RPC 가 필요하다 — 코드 주석).
- 조회 실패(이력·표 모두)는 배너 없이 빈 화면으로 떨어지고 원인은 서버 로그에만 남는다.
- `?snapshot=` 에 없는 시각을 넣으면 "과거 스냅샷 · 0건" 으로 그려진다(404 가 아니다).
- 읽기 전용 관리자에게는 `되돌리기` 버튼이 아예 그려지지 않고, 직접 POST 는 액션의 `requirePermission('rankings','write')` 가 막는다.
