# 랭킹 — 메뉴 개요

> 관리자 콘솔(`admin/`)의 랭킹 메뉴. 화면 하나당 파일 하나이며, 각 파일은 `_TEMPLATE.md` 형식을 따른다.
> 작성 규칙: 코드에서 확인한 사실만 쓴다. 경로는 저장소 루트 기준. 워딩은 "카테고리".

## 0. 한눈에

| 항목 | 값 |
|---|---|
| 경로 | `/rankings` (하위 라우트 없음. 화면 상태는 `?type=`·`?snapshot=` 로만 바뀐다) |
| 권한 모듈 | `rankings` — read / write (`admin/lib/auth/permissions.ts`). read 는 현재/과거 표와 스냅샷 이력을 본다. write 면 이력 행에 `되돌리기` 버튼이 추가로 보인다(현재 스냅샷 행에는 그래도 뜨지 않는다) |
| 주요 테이블 | `rankings`(`rank_type`·`rank`·`character_name`·`avatar_url`·`level`·`job`·`job_group`·`guild`·`guild_icon_url`·`exp text`·`snapshot_at`). 제약 `rankings_rank_positive`(rank ≥ 1), `rankings_unique_rank unique(rank_type, snapshot_at, rank)` |
| 클라이언트 영향 | 캐시 태그 `rankings` 재검증 → 사용자 사이트 `/ranking`. 단 `FEATURES.rankingOpen` 이 꺼져 있으면 조회 자체를 건너뛰고 준비 중 카드만 그린다(플래그 우선) |
| 관련 파일 | 페이지 `admin/app/(admin)/rankings/page.tsx` · 컴포넌트 `admin/components/rankings/{SnapshotHistory,RollbackSnapshotButton}.tsx` · 액션 `admin/lib/actions/rankings-actions.ts` · 데이터 `admin/lib/data/rankings.ts` · 검증(어휘) `admin/lib/validation/rankings.ts` · 마이그레이션 `supabase/migrations/20260908000500_site_content.sql` · 클라이언트 `app/(public)/ranking/page.tsx`, `lib/data/rankings.ts`, `lib/constants/ranking.ts` |

## 1. 화면 목록

| # | 문서 | 경로 | 한 줄 |
|---|---|---|---|
| 01 | [01-main.md](01-main.md) | `/rankings` | 종류 탭 · 현재/과거 스냅샷 표 · 스냅샷 이력 |
| 02 | [02-rollback-dialog.md](02-rollback-dialog.md) | 이력 행 조치 | 과거 스냅샷을 새 스냅샷으로 다시 올리는 확인 다이얼로그 |

## 2. 메뉴 전체 규칙

- **적재(업로드) 화면은 없다.** CSV·JSON 업로드 폼, 붙여넣기 입력, 파일 드롭 어느 것도 코드에 없다. 순위 데이터는 개발팀 게임 데이터 연동이 `rankings` 에 **스냅샷 단위로 직접 적재**한다(2026-09-09 제품 결정, `admin/lib/validation/rankings.ts` 머리말). 관리자에 남은 쓰기는 `rollbackRankingSnapshotAction` 하나뿐이므로, 순위 자체를 바꾸려면 연동 쪽을 고쳐야 한다.
- **스냅샷 모델** "현재 랭킹" = 해당 `rank_type` 의 **가장 최근 `snapshot_at`** 한 벌. 그보다 오래된 `snapshot_at` 은 이력이다. `rank_type` 당 `SNAPSHOT_RETENTION`(5)벌까지 보관하고 초과분은 되돌리기 직후 정리된다.
- **종류(카테고리)** `RANK_TYPES` = `total`(종합 랭킹) · `job`(직업 랭킹) · `guild`(길드 랭킹). DB enum `ranking_type` 과 `satisfies` 로 묶여 있다. 기본값 `DEFAULT_RANK_TYPE = 'total'`.
- **직업군 어휘** `JOB_GROUPS` = `adventurer`(모험가) · `cygnus`(시그너스) · `resistance`(레지스탕스) · `hero`(영웅) · `demon`(데몬(마족)), DB enum `job_group`.
- **원자성** 스냅샷 교체는 원자적이지 않다. PostgREST 로는 여러 문장을 한 트랜잭션에 묶을 수 없어 "새 스냅샷 insert(500행씩) → 실패하면 그 `snapshot_at` 만 삭제 → 성공 시 오래된 스냅샷 정리" 순서로 구현했다. 먼저 지우는 방식이면 실패 시 랭킹이 통째로 빈다. 진짜 원자적 교체가 필요하면 `replace_ranking_snapshot(p_rank_type, p_rows jsonb)` 같은 SECURITY DEFINER RPC 가 있어야 한다(`rankings-actions.ts` 머리말).
- **감사 로그** `rankings.snapshot.rollback` 하나. `target_table='rankings'`, `target_id = '<rankType>@<새 snapshot_at>'`. 감사 화면 라벨은 "랭킹 스냅샷 되돌리기"(`DOMAIN_LABELS.rankings` + `SEGMENT_LABELS.snapshot` + `VERB_LABELS.rollback`), 대상 링크는 `/rankings`.
- **`dynamic = 'force-dynamic'`** — 되돌린 직후 옛 스냅샷이 보이면 운영자가 같은 조작을 반복한다.
