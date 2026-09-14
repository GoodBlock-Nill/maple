# 랭킹 — 되돌리기 다이얼로그 (`/rankings` 이력 행 조치)

**목적** 과거 스냅샷의 내용을 현재 시각의 새 스냅샷으로 다시 올린다(`RollbackSnapshotButton`). 이력을 고쳐 쓰지 않는다 — 언제 무엇을 되돌렸는지가 사라지면 감사 로그와 이력이 어긋난다. 관리자 콘솔에 남은 유일한 랭킹 쓰기 조작이다.

**데이터 출처** 다이얼로그 자체는 이력 행이 가진 값(`rankType`·`snapshotAt`·표기용 `label`·`count`)만 쓴다. 실제 행 복제는 액션이 실행 시점에 다시 조회한다.

## 1.1 다이얼로그

| 필드/컨트롤 | 종류 | 필수·제한 | 기본값 | 동작 |
|---|---|---|---|---|
| 되돌리기(행) | 버튼(secondary, sm) | write 권한 + 최신 아님 | — | 다이얼로그를 연다 |
| 제목 | 고정 문구 | — | `이 스냅샷으로 되돌리기` | — |
| 설명 | 고정 문구 | — | 아래 상세 참고 | 오해를 막는 문장 |
| rankType | hidden | `isRankType()` 통과 | 현재 탭 | — |
| snapshotAt | hidden | 빈 값 불가 | 행의 `snapshot_at` | — |
| 오류 배너 | `FormBanner` | — | 없음 | 다이얼로그 안에 표시 |
| 취소 | 버튼(secondary) | 처리 중 비활성 | — | 닫기만 |
| 되돌리기 | 제출 버튼 | 처리 중 비활성 | — | `rollbackRankingSnapshotAction` |

**동작 상세**

- **설명** 문구는 `{스냅샷 시각} 의 {건수}건을 새 스냅샷으로 다시 올립니다. 기존 이력은 그대로 남습니다.` 다.
- **rankType·snapshotAt** 둘 중 하나라도 조건을 못 채우면 "되돌릴 스냅샷을 찾을 수 없습니다."로 끝난다.
- **오류 배너** 실패해도 다이얼로그는 닫히지 않는다.
- **되돌리기** 처리 중에는 `적용 중…` 으로 바뀐다.

## 1.2 서버 동작 (`rollbackRankingSnapshotAction`)

| 단계 | 내용 |
|---|---|
| 권한 | `requirePermission('rankings','write')` |
| 검증 | zod 없음. `isRankType()` 과 빈 문자열만 검사 |
| 원본 조회 | 같은 `rank_type`+`snapshot_at` 행을 `rank` 순으로 읽는다 |
| 삽입 | 새 `snapshot_at` 으로 500행씩 insert |
| 정리 | `pruneSnapshots()` 로 보관 한도 초과분 삭제 |
| 감사 | `rankings.snapshot.rollback` |
| 캐시 | `revalidatePath('/rankings')` + `revalidateClient(['rankings'])` |

**동작 상세**

- **원본 조회** 복제 컬럼은 `rank`, `character_name`, `level`, `job`, `job_group`, `guild`, `exp`, `avatar_url` 이다(`RankingUploadRow` 모양). `guild_icon_url` 은 복제 대상이 아니다.
- **삽입** `snapshotAt = new Date().toISOString()` 하나를 정해 `CHUNK_SIZE`(500)행씩 넣는다.
- **삽입** 도중 실패하면 그 `snapshot_at` 전체를 삭제하고 중단한다. 반쪽짜리 스냅샷이 최신으로 남으면 사용자 사이트 랭킹이 잘린 채 보이기 때문이다.
- **정리** 이력 6번째부터(`SNAPSHOT_RETENTION` = 5) 삭제한다. 실패해도 되돌리지 않고 `console.error('[rankings] 오래된 스냅샷 정리 실패')` 만 남긴다 — 최신 스냅샷은 이미 올바르다.
- **감사** `target_id` 는 `<rankType>@<새 snapshot_at>` 이다.
- **감사** `before` 는 `{ rank_type, snapshot_at: 원본 }`, `after` 는 `{ rank_type, snapshot_at: 새 값, rows: 삽입 건수 }` 다.
- **성공** 토스트 문구는 `{N}건을 되돌렸습니다.` 이고 다이얼로그가 닫힌다.

**상태 변화**

되돌린 뒤 이력은 이렇게 된다 — 원본 과거 행은 그대로 남고, 맨 위에 같은 내용의 새 스냅샷이 하나 더 생긴다(`현재` 뱃지가 그쪽으로 옮겨 간다). 그 결과 보관 벌 수가 5를 넘으면 가장 오래된 한 벌이 정리된다.

**클라이언트와의 상호작용**

- 사용자 사이트 `/ranking` 은 최신 `snapshot_at` 만 읽으므로, 새 스냅샷이 완전히 들어간 순간 교체가 끝난 것과 같다.
- 태그 `rankings` 재검증으로 즉시 반영되고, 재검증이 실패해도 최대 60초 뒤에는 바뀐다.
- 되돌리기는 `rank_type='total'` 을 되돌릴 때만 사용자 화면에 영향이 있다(사용자 화면의 모집단이 `total` 고정, → [01-main.md](01-main.md)).
- `FEATURES.rankingOpen` 이 꺼져 있으면 어떤 되돌리기도 사용자 화면에 나타나지 않는다.

**오류·예외**

- `rankType`·`snapshotAt` 이 비었을 때: "되돌릴 스냅샷을 찾을 수 없습니다."
- 원본 행이 하나도 없을 때(보관 한도 5벌을 넘겨 정리됨): "이미 정리된 스냅샷입니다."
- 원본 조회 실패: "스냅샷을 읽지 못했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요."
- 삽입 실패: "랭킹을 적용하지 못했습니다. 기존 랭킹은 그대로입니다. 다시 시도해 주세요."
- 동시 조작 보호가 없다. 되돌리는 중에 연동이 새 스냅샷을 적재하면 두 벌이 비슷한 시각으로 쌓이고, `snapshot_at` 이 더 늦은 쪽이 "현재"가 된다.
- 삽입 실패 시의 되돌림(그 `snapshot_at` 삭제)마저 실패하면 반쪽 스냅샷이 최신으로 남을 수 있다. 그때는 이력에서 직전 스냅샷으로 다시 되돌리는 것이 복구 수단이다.
- `rankings_unique_rank(rank_type, snapshot_at, rank)` 제약 때문에 같은 밀리초로 두 번 삽입되면 제약 위반으로 거절된다(위 실패 경로).
