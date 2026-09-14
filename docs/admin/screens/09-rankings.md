# 랭킹 — 화면·기능 설명

> 관리자 콘솔(`admin/`)의 랭킹 메뉴. 경로 · 권한 · 화면 구성 · 동작(서버 액션) · 클라이언트(사용자 사이트)와의 상호작용을 개발 참고용으로 정리한다.
> 작성 규칙: 코드에서 확인한 사실만 쓴다. 파일 경로는 저장소 루트 기준. 워딩은 "카테고리"(말머리 금지).

## 0. 한눈에

| 항목 | 값 |
|---|---|
| 경로 | `/rankings` |
| 권한 모듈 | `rankings` — read / write (`admin/lib/auth/permissions.ts`) |
| 주요 테이블 | `rankings`(스냅샷 단위 적재) |
| 클라이언트 영향 | 캐시 태그 `rankings` 재검증 → 사용자 사이트 `/ranking` 즉시 반영(단 `NEXT_PUBLIC_FEATURE_RANKING_COMING_SOON=true`면 사용자 사이트는 준비 중 카드만 그린다) |
| 관련 파일 | `admin/app/(admin)/rankings/page.tsx`, `admin/components/rankings/*`, `admin/lib/{actions,data,validation}/rankings.ts` |

## 1. 랭킹 (`/rankings`)

**목적** 종류별(종합/직업/길드) 최신 랭킹 표를 확인하고, 필요하면 과거 스냅샷으로 되돌린다. **적재(순위 갱신) 자체는 이 화면에 없다** — 개발팀 게임 데이터 연동이 `rankings`에 스냅샷 단위로 직접 넣는다(2026-09-09 제품 결정, `admin/README.md` §3).

**화면 구성**
- 탭: `RANK_TYPES`(`total`·`job`·`guild`, `admin/lib/validation/rankings.ts`).
- `?snapshot=` 쿼리로 과거 스냅샷을 볼 수 있다. 최신이 아닌 스냅샷을 보는 중이면 "사이트에 보이는 표가 아닙니다" 경고 뱃지가 붙고, "현재 스냅샷 보기" 링크가 나온다.
- 현재/과거 표(`RankingRow`): 순위, 캐릭터명(직업군), 레벨, 직업, 길드, 경험치.
- 스냅샷 이력 카드(`SnapshotHistory`): 스냅샷 시각(현재/보는 중 뱃지), 건수, [보기] 링크, [쓰기 권한만] 되돌리기 버튼(현재 스냅샷에는 뜨지 않음). `rank_type`당 최근 `SNAPSHOT_RETENTION`(5)벌만 보관한다.

**동작(서버 액션)**
| 동작 | 액션 함수 | 검증 | DB 변경 | 감사 로그 | 클라이언트 영향 |
|---|---|---|---|---|---|
| 스냅샷 되돌리기 | `rollbackRankingSnapshotAction` (`admin/lib/actions/rankings-actions.ts`) | `rankType`/`snapshotAt` 존재 확인(zod 없음) | 과거 스냅샷 행을 **읽어 현재 시각의 새 스냅샷으로 재삽입**(`rankings` insert) + 보관 한도(5벌) 초과분 삭제 | `rankings.snapshot.rollback` | `revalidatePath('/rankings')` + 태그 `rankings` 재검증 |

**클라이언트와의 상호작용**
- 사용자 사이트 `/ranking`(`app/(public)/ranking/page.tsx` → `lib/data/rankings.ts`)은 `rank_type`별 **가장 최근 `snapshot_at`** 한 벌만 `unstable_cache`(60초, 태그 `rankings`)로 읽는다. 관리자 표시 열보다 사용자 화면에 보이는 열이 더 많다(순위 표시 방식은 클라이언트 컴포넌트가 별도 결정).
- `FEATURES.rankingOpen`(`NEXT_PUBLIC_FEATURE_RANKING_COMING_SOON !== 'true'`, `lib/constants/features.ts`)이 꺼져 있으면 `/ranking`은 Supabase 조회 자체를 건너뛰고 준비 중 카드만 그린다 — 관리자 스냅샷 상태와 무관하다.
- 되돌리기는 이력을 고쳐 쓰지 않는다. "같은 내용의 새 스냅샷"을 현재 시각으로 다시 넣으므로, 되돌린 직후에도 스냅샷 이력에는 원래 있던 과거 행이 그대로 남고 맨 위에 새 항목이 하나 더 생긴다.

**주의**
- 스냅샷 교체는 원자적이지 않다: PostgREST로는 여러 문장을 한 트랜잭션으로 묶을 수 없어 "새 스냅샷 insert → 실패 시 그 스냅샷만 삭제" 순서로 구현했다. 진짜 원자적 교체가 필요하면 SECURITY DEFINER RPC가 있어야 한다(코드 주석).
- 오래된 스냅샷 정리가 실패해도 적용 자체는 되돌리지 않는다(최신 스냅샷은 이미 올바르다).
- 스냅샷 이력 집계는 최대 `SNAPSHOT_SCAN_LIMIT`(5000)행까지만 훑는다(PostgREST가 group by를 지원하지 않아 앱에서 직접 센다).
- 관리자에는 랭킹 업로드/입력 폼이 없다 — 순위 자체를 바꾸려면 개발팀 연동 쪽을 고쳐야 한다.
