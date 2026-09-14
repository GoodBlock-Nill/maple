# 신고 — 메뉴 개요

> 관리자 콘솔(`admin/`)의 신고 메뉴. 사용자가 접수한 게시글·댓글 신고를 검토하고, 숨김·삭제·정지로 연계 조치한 뒤 종결(처리/기각)한다.
> 작성 규칙: 코드에서 확인한 사실만 쓴다. 파일 경로는 저장소 루트 기준. 워딩은 "카테고리".

## 0. 한눈에
| 항목 | 값 |
|---|---|
| 경로 | `/reports` (별도 라우트 없음 — "신고 상세"는 목록 행에서 여는 다이얼로그) |
| 권한 모듈 | `reports` — read / write(아래) |
| 주요 테이블 | `reports`, 조치에 따라 `posts`/`comments`, `profiles`(아래) |
| 클라이언트 영향 | 캐시 태그 없음, 조치별 재검증 경로(아래) |
| 관련 파일 | 페이지·컴포넌트·액션·데이터·검증·마이그레이션(아래) |

**동작 상세**
- **권한 모듈** — `reports` — read / write. **read**: 탭·유형 필터·목록·상세 다이얼로그 열람(버튼 라벨이 "상세", 처리/기각 탭이 렌더되지 않는다). **write**: 미처리 행의 버튼이 "처리"가 되고 다이얼로그에 처리·기각 폼이 붙는다. 처리 중 대상 숨김·삭제는 `requireAnyPermission(['community','reports'],'write')`, 작성자 정지는 `requirePermission('members','write')`(= `suspendMember()` 안).
- **주요 테이블** — `reports`(`target_type`·`target_id`·`reporter_id`·`reason`·`detail`·`status`·`created_at`·`note`·`resolved_by`·`resolved_at`). 조치에 따라 연쇄: `posts`/`comments`(`is_hidden`·`deleted_at`), `profiles`(`suspended_until`·`suspension_reason`).
- **클라이언트 영향** — `reports` 자체는 사용자 사이트가 읽지 않아 캐시 태그가 없다. 처리에서 **숨김·삭제**를 고르면 `moderateTarget()` 이 `community-list` 를 재검증 → `/community` 목록 반영. **정지**는 관리자 화면 `/members/[id]` 만 `revalidatePath`(정지 여부는 매 요청 세션에서 읽으므로 캐시 무효화가 필요 없다).
- **관련 파일** — 페이지 `admin/app/(admin)/reports/page.tsx` · 컴포넌트 `admin/components/reports/{ReportTabs,ReportTypeFilter,ReportDetailDialog,ReportResolveForm,ReportDismissForm,report-icons}.tsx` · 액션 `admin/lib/actions/reports-actions.ts`(+`moderation-actions.ts`, `members-actions.ts`) · 데이터 `admin/lib/data/reports.ts` · 검증 `admin/lib/validation/{moderation,members}.ts` · 마이그레이션 `20260908001100_reports_and_author_edits`, `20260908001700_admin_foundation`, `20260908002100_reports_admin_update_and_notes`.

## 화면 목록
| 파일 | 경로 | 설명 |
|---|---|---|
| [01-list.md](01-list.md) | `/reports` | 상태 탭 · 유형 필터 · 신고 목록 8열 · 페이지네이션 |
| [02-detail-dialog.md](02-detail-dialog.md) | (목록의 "처리"/"상세" 버튼) | 대상 전문 · 신고 메타 · 같은 대상 이력 · 처리/기각 폼 |

## 메뉴 전체 규칙

### 상태 3종 (`REPORT_STATUSES`)
| 값 | 라벨 | 세우는 주체 | 의미 |
|---|---|---|---|
| `open` | 미처리 | 접수 시 기본값(DB `default 'open'`, 정책 `reports_insert_own` 이 `status = 'open'` 강제) | 검토 대기 |
| `resolved` | 처리 완료 | `resolveReportAction` | 조치(또는 "조치 없음")를 적용하고 종결 |
| `dismissed` | 기각 | `dismissReportAction` | 신고가 타당하지 않다고 판단해 종결 |

DB CHECK `reports_status_check (status in ('open','resolved','dismissed'))`. **DELETE 정책이 없다** — 신고 이력은 지우지 않고 `status` 로만 종결한다.

### 사유 5종 (`report_reason` enum)
| 값 | 관리자 라벨(`REPORT_REASON_LABEL`) | 사용자 라벨(`lib/constants/report.ts`) |
|---|---|---|
| `spam` | 스팸·광고 | 스팸·광고 |
| `abuse` | 욕설·비방 | 욕설·비방 |
| `obscene` | 음란·불쾌 | 음란·불쾌 |
| `privacy` | 개인정보 노출 | 개인정보 노출 |
| `other` | 기타 | 기타 |

두 목록은 **글자까지 같아야 한다** — 운영자가 보는 문구와 신고자가 고른 문구가 다르면 문의가 들어왔을 때 같은 신고를 이야기하는지 확인하는 데 시간이 든다.

### 조회 구조 (질의 4개 고정)
`reports.target_id` 는 `posts`·`comments` 두 테이블을 가리키는 **다형 참조**라 FK 가 없고 PostgREST 임베드로 끌어올 수 없다. 그래서 `getReports()` 는 한 페이지분 id 를 모아 테이블별로 한 번씩 읽는다.

1. `reports` 한 페이지(20건) + `profiles!reports_reporter_id_fkey(nickname)` 임베드 — **FK 힌트가 필수**다(`reporter_id`·`resolved_by` 두 FK 가 `profiles` 를 가리켜, 힌트가 없으면 PostgREST 가 "more than one relationship was found"로 반려해 목록이 통째로 빈다)
2. 대상 게시글 일괄 조회 3. 대상 댓글 일괄 조회 (+댓글의 부모 글 제목만 추가 조회, 이미 읽은 글은 건너뛴다)
4. 같은 대상들의 **전체 신고 이력**(상태 무관, `created_at desc`)

다이얼로그는 열릴 때 추가 요청을 하지 않는다 — 본문·이력이 이미 실려 있다(행마다 다시 읽으면 20건 목록이 60질의가 된다).

### 감사 로그
| action | 언제 | before/after |
|---|---|---|
| `report.resolve` | 처리 완료 | before `{ status }`, after 상세(아래) |
| `report.dismiss` | 기각 | before `{ status }`, after `{ status:'dismissed', note, report_ids, target }` |
| `community.{post\|comment}.{hide\|delete}` | 처리에서 숨김·삭제를 고른 경우 `moderateTarget()` 이 추가로 남긴다 | 콘텐츠 조치 스냅샷 |
| `member.suspend` | 처리에서 정지를 고른 경우 `suspendMember()` 가 추가로 남긴다 | 정지 전/후 |

- **`report.resolve` after** — `{ status:'resolved', note, moderation(조치 종류), report_ids(함께 종결한 id 배열), target:{type,id} }`.

**신고 1건 처리에 감사 로그가 2행 남을 수 있다**(조치 + 종결). 라벨 매핑은 정상이다: `DOMAIN_LABELS.report = '신고'`, `VERB_LABELS.resolve = '처리'`, `dismiss = '기각'`, `TABLE_LABELS.reports = '신고'`. (같이 남는 `community.*` 행은 라벨이 없어 영문으로 보인다 — [커뮤니티 README](../03-community/README.md#감사-로그) 참고.)

### `reports` 쓰기만 서비스 롤을 쓴다
`setReportStatus()` (`admin/lib/actions/reports-actions.ts`)는 `createAdminClient()`(서비스 롤)로 UPDATE 한다. 근거와 범위:
- `reports_update_admin` 정책은 있지만, 마이그레이션 `20260908001100` 이 GRANT 를 `select, insert` 로만 되돌려 세션 클라이언트의 UPDATE 가 정책 평가 **전에** 42501 로 막혔다(실측 확인).
- `20260908002100` 이 `grant update on public.reports to authenticated` 를 더했지만 코드의 우회는 그대로 남아 있다. 코드 주석은 "마이그레이션으로 update GRANT 를 더하면 이 우회는 지워야 한다"고 적어 둔다 — **지금은 그 조건이 충족된 상태다**(정리 대상).
- 우회 범위는 처리 컬럼(`status`·`note`·`resolved_by`·`resolved_at`)뿐이고, 호출 전에 반드시 `requirePermission('reports','write')` 를 통과한다. 나머지 조회는 전부 세션 클라이언트다.
- 접수 원문은 트리거 `guard_report_admin_columns` 가 지킨다: 일반 사용자의 INSERT 는 `status='open'`·메모/처리자/처리시각 `null` 로 눌리고, UPDATE 에서는 처리 컬럼과 원문(`target_*`·`reporter_id`·`reason`·`detail`·`created_at`)이 전부 이전 값으로 되돌려진다.

### 중복 접수 방지
유니크 제약 `reports_unique_reporter (target_type, target_id, reporter_id)` — 같은 사람이 같은 대상을 여러 번 신고해도 큐에는 한 건만 남는다. 따라서 목록의 "누적"은 **서로 다른 신고자 수**와 같다.
