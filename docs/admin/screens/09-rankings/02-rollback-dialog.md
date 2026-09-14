# 랭킹 — 되돌리기 다이얼로그 (`/rankings` 이력 행 조치)

**목적** 과거 스냅샷의 내용을 **현재 시각의 새 스냅샷으로 다시 올린다**(`RollbackSnapshotButton`). 이력을 고쳐 쓰지 않는다 — 언제 무엇을 되돌렸는지가 사라지면 감사 로그와 이력이 어긋난다. 관리자 콘솔에 남은 유일한 랭킹 쓰기 조작이다.

**데이터 출처** 다이얼로그 자체는 이력 행이 가진 값(`rankType`·`snapshotAt`·표기용 `label`·`count`)만 쓴다. 실제 행 복제는 액션이 실행 시점에 다시 조회한다.

## 1.1 다이얼로그

| 필드/컨트롤 | 종류 | 필수·제한 | 기본값 | 동작 / 상호작용 |
|---|---|---|---|---|
| 되돌리기(행) | 버튼(secondary, sm) | **write 권한 + 최신이 아닌 스냅샷 행**에만 렌더 | — | 다이얼로그를 연다 |
| 제목 | 고정 문구 | — | `이 스냅샷으로 되돌리기` | — |
| 설명 | 고정 문구 | — | `{스냅샷 시각} 의 {건수}건을 새 스냅샷으로 다시 올립니다. 기존 이력은 그대로 남습니다.` | "이력이 지워진다"는 오해를 막는 문장 |
| rankType | hidden | `isRankType()` 통과해야 함 | 현재 탭 | 아니면 "되돌릴 스냅샷을 찾을 수 없습니다." |
| snapshotAt | hidden | 빈 값 불가 | 행의 `snapshot_at` | 위와 같은 오류 문구 |
| 오류 배너 | `FormBanner` | — | 없음 | 실패 시 다이얼로그 안에 표시(닫히지 않는다) |
| 취소 | 버튼(secondary) | 처리 중 비활성 | — | 닫기만 |
| 되돌리기 | 제출 버튼 | 처리 중 `적용 중…` + 비활성 | — | `rollbackRankingSnapshotAction` 호출 |

## 1.2 서버 동작 (`rollbackRankingSnapshotAction`)

| 단계 | 내용 |
|---|---|
| 권한 | `requirePermission('rankings','write')` |
| 검증 | zod 스키마 없음. `readField` 로 읽어 `isRankType()` 과 빈 문자열만 검사 |
| 원본 조회 | `rankings` 에서 `rank_type`+`snapshot_at` 이 일치하는 행의 `rank, character_name, level, job, job_group, guild, exp, avatar_url` 을 `rank` 오름차순으로(→ `RankingUploadRow` 모양). `guild_icon_url` 은 복제 대상이 아니다 |
| 빈 결과 | "이미 정리된 스냅샷입니다."(보관 한도 5벌을 넘겨 정리된 경우) |
| 삽입 | `snapshotAt = new Date().toISOString()` 하나를 정해 `CHUNK_SIZE`(500)행씩 `insert`. 도중 실패하면 **그 `snapshot_at` 전체를 삭제**하고 중단 — 반쪽짜리 스냅샷이 최신으로 남으면 사용자 사이트 랭킹이 잘린 채 보인다 |
| 정리 | 성공 후 `pruneSnapshots()` — 이력 6번째부터(`SNAPSHOT_RETENTION` = 5) 삭제. 실패해도 되돌리지 않고 `console.error('[rankings] 오래된 스냅샷 정리 실패')` 만 남긴다(최신 스냅샷은 이미 올바르다) |
| 감사 | `rankings.snapshot.rollback` · `target_id = '<rankType>@<새 snapshot_at>'` · `before = { rank_type, snapshot_at: 원본 }` · `after = { rank_type, snapshot_at: 새 값, rows: 삽입 건수 }` |
| 캐시 | `revalidatePath('/rankings')` + `revalidateClient(['rankings'])` |
| 성공 | `showToast('{N}건을 되돌렸습니다.', 'success')` + 다이얼로그 닫힘 |
| 실패(조회) | "스냅샷을 읽지 못했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요." |
| 실패(삽입) | "랭킹을 적용하지 못했습니다. 기존 랭킹은 그대로입니다. 다시 시도해 주세요." |

**상태 변화**

되돌린 뒤 이력은 이렇게 된다 — 원본 과거 행은 **그대로 남고**, 맨 위에 같은 내용의 새 스냅샷이 하나 더 생긴다(`현재` 뱃지가 그쪽으로 옮겨 간다). 그 결과 보관 벌 수가 5를 넘으면 가장 오래된 한 벌이 정리된다.

**클라이언트와의 상호작용**

- 사용자 사이트 `/ranking` 은 최신 `snapshot_at` 만 읽으므로, 새 스냅샷이 완전히 들어간 순간 교체가 끝난 것과 같다. 태그 `rankings` 재검증으로 즉시 반영되고, 재검증이 실패해도 최대 60초 뒤에는 바뀐다.
- 되돌리기는 `rank_type='total'` 을 되돌릴 때만 사용자 화면에 영향이 있다(사용자 화면의 모집단이 `total` 고정, → [01-main.md](01-main.md)).
- `FEATURES.rankingOpen` 이 꺼져 있으면 어떤 되돌리기도 사용자 화면에 나타나지 않는다.

**오류·예외**

- **동시 조작 보호 없음.** 되돌리는 중에 연동이 새 스냅샷을 적재하면 두 벌이 비슷한 시각으로 쌓이고, `snapshot_at` 이 더 늦은 쪽이 "현재"가 된다.
- 삽입 도중 실패 시의 되돌림(그 `snapshot_at` 삭제)마저 실패하면 반쪽 스냅샷이 최신으로 남을 수 있다 — 그때는 이력에서 직전 스냅샷으로 다시 되돌리는 것이 복구 수단이다.
- `rankings_unique_rank(rank_type, snapshot_at, rank)` 제약 때문에, 같은 밀리초로 두 번 삽입되는 경우는 제약 위반으로 거절된다(위 실패 경로).
