# 신고 — 화면·기능 설명

> 관리자 콘솔(`admin/`)의 신고 메뉴. 경로 · 권한 · 화면 구성 · 동작(서버 액션) · 클라이언트(사용자 사이트)와의 상호작용을 개발 참고용으로 정리한다.
> 작성 규칙: 코드에서 확인한 사실만 쓴다. 파일 경로는 저장소 루트 기준. 워딩은 "카테고리"(말머리 금지).

## 0. 한눈에
| 항목 | 값 |
|---|---|
| 경로 | `/reports` (하위 화면 없음 — "신고 상세"는 목록 행에서 여는 다이얼로그) |
| 권한 모듈 | `reports` — read(목록·상세 열람) / write(처리·기각). 처리 시 숨김·삭제 실행은 `community` 또는 `reports` 중 하나만 write여도 통과(`requireAnyPermission`) |
| 주요 테이블 | `reports` (조치에 따라 연쇄: `posts`/`comments`(숨김·삭제), `profiles`(정지)) |
| 클라이언트 영향 | `reports` 자체는 사용자 사이트가 읽지 않아 캐시 태그가 없음. 처리에서 숨김·삭제를 고르면 태그 `community-list` 재검증 → `/community` 목록 반영. 정지는 관리자 화면(`/members/[id]`)만 갱신, 클라이언트 영향 없음 |
| 관련 파일 | `admin/app/(admin)/reports/page.tsx`, `admin/components/reports/**`, `admin/lib/actions/reports-actions.ts`, `admin/lib/data/reports.ts`, `admin/lib/validation/moderation.ts` |

## 1. 신고 (`/reports`)
**목적** 접수된 신고를 검토하고 상세 다이얼로그에서 처리(숨김·삭제·정지)하거나 기각한다.

**화면 구성**
- 상태 탭(`ReportTabs`): 미처리 / 처리 완료 / 기각, 탭마다 건수 표시(현재 유형 필터가 걸려 있으면 그 필터가 적용된 건수)
- 유형 필터 칩(`ReportTypeFilter`): 전체 / 게시글 / 댓글 — 상태 탭과 별개 축이라 동시에 적용된다
- 표 열:
  - 유형: 게시글(accent 톤 + 문서 아이콘) / 댓글(neutral 톤 + 말풍선 아이콘), 대상이 숨김·삭제 상태면 추가 뱃지
  - 대상: 원문 발췌(제목 또는 댓글 내용, 클릭 시 사용자 사이트 원문 새 탭 — 댓글도 원 게시글로 이동), 댓글이면 "↳ 게시글: {제목}" 한 줄 추가, 삭제된 대상은 링크 없이 텍스트만
  - 사유, 상세(신고자가 남긴 텍스트), 신고자 닉네임, 신고일, 누적(같은 대상에 접수된 전체 신고 건수, 2건 이상이면 강조)
  - 조치: "처리"(미처리 + write) 또는 "상세"(그 외) 버튼 — 2절 다이얼로그를 연다

**동작(서버 액션)**
이 화면 자체(목록·탭·필터)는 조회 전용이다. 상태 변경은 2절의 다이얼로그에서 이뤄진다.

**클라이언트와의 상호작용**
- `reports` 테이블은 관리자 전용이며 사용자 사이트가 읽지 않는다(캐시 태그 없음).
- 사용자 사이트에서 들어오는 신고 접수: `components/board/ReportDialog.tsx` + `ReportForm.tsx`(게시글·댓글 공용) → 서버 액션 `submitReport` (`lib/actions/report-actions.ts`) → `reports` INSERT. 로그인 필요, 정지 중이면 접수 차단, 자기 글 신고 불가, 쿨다운(연속 신고 방지), 같은 대상 중복 신고는 유니크 제약(`reports_unique_reporter`)으로 막는다.
- 대상 원문 링크는 사용자 사이트 `/community/[postId]`로 연결된다(댓글도 원 게시글 페이지).

**주의**
- 대상이 이미 완전히 삭제되어 조회되지 않으면 "대상 없음"으로 표시된다.

## 2. 신고 상세 다이얼로그 (목록의 "처리"/"상세" 버튼)
**목적** 신고 내용과 같은 대상의 신고 이력을 한 화면에서 확인하고, 처리(조치 + 종결) 또는 기각한다.

**화면 구성**
- 상세 영역: 작성자, 숨김/삭제 뱃지, 게시글이면 제목, 댓글이면 원 게시글 제목, 본문 전문, "원문 보기"·"작성자 보기" 버튼
- 메타: 신고자, 사유, 상세, 누적 신고 건수
- 같은 대상의 신고 이력 목록(2건 이상일 때만, 신고일·신고자·사유·상태)
- write 권한자에게만 "처리"/"기각" 탭:
  - **처리 탭**(`ReportResolveForm`): 조치 라디오(대상 숨김 / 대상 삭제 / 작성자 정지 / 조치 없이 처리), 정지 선택 시 기간(1일/3일/7일/30일/영구) + 정지 사유(≤200자, 사용자 화면 정지 배너에 그대로 노출) 추가 노출, 처리 메모(≤500자, 사용자에게 비노출), "같은 대상의 미처리 신고 N건을 함께 처리" 체크(2건 이상일 때만 노출, 기본 체크)
  - **기각 탭**(`ReportDismissForm`): 기각 사유(필수, ≤500자), "함께 기각" 체크(위와 동일 조건)

**동작(서버 액션)**
| 동작 | 액션 함수 | 검증 | DB 변경 | 감사 로그 | 클라이언트 영향 |
|---|---|---|---|---|---|
| 처리 완료(대상 숨김) | `resolveReportAction` (`admin/lib/actions/reports-actions.ts`), 내부에서 `moderateTarget()` (`admin/lib/actions/moderation-actions.ts`) 호출 | zod `resolveReportSchema` (`admin/lib/validation/moderation.ts`) | `posts`/`comments`.is_hidden=true, 그리고 `reports`.status='resolved', note, resolved_by, resolved_at(대상 신고 + `applyToTarget`이면 같은 대상의 미처리 신고 전부) | `community.post.hide` 또는 `community.comment.hide` (moderateTarget이 기록) + `report.resolve`(이 액션이 기록, `after`에 note·moderation·대상 정보 포함) — **신고 1건 처리에 감사 로그 2건** | 태그 `community-list` |
| 처리 완료(대상 삭제) | 동일, `moderateTarget()`이 삭제 모드 | 동일 | `posts`/`comments`.deleted_at=now(), `reports` 위와 동일 | `community.post.delete`/`community.comment.delete` + `report.resolve` | 태그 `community-list` |
| 처리 완료(작성자 정지) | 동일, 내부에서 `suspendMember()` (`admin/lib/actions/members-actions.ts`) 호출 | 동일 + 정지 기간·사유 필수(`resolveReportSchema`의 `superRefine`) | `profiles.suspended_until`, `suspension_reason`, `reports` 위와 동일 | `member.suspend` + `report.resolve` | 없음(관리자 화면 `/members/[authorId]`만 `revalidatePath`) |
| 처리 완료(조치 없음) | 동일, 조치 단계 생략 | 동일 | `reports` 위와 동일만 | `report.resolve` | 없음 |
| 기각 | `dismissReportAction` (같은 파일) | zod `dismissReportSchema` | `reports`.status='dismissed', note, resolved_by, resolved_at(대상 신고 + `applyToTarget`이면 함께) | `report.dismiss` | 없음 |

**클라이언트와의 상호작용**
- 대상 숨김·삭제 조치만 사용자 사이트에 영향을 준다 — `moderateTarget()`이 `community-list` 태그를 재검증해 `/community` 목록에 즉시 반영한다(상세는 세션 조회라 이미 즉시 404).
- 작성자 정지는 사용자 사이트 캐시에 영향이 없다 — 정지 여부는 로그인 세션에서 매 요청 확인되는 값이라 별도 캐시 무효화가 필요 없다.

**주의**
- `reports` 테이블의 상태 변경(`setReportStatus`)만 서비스 롤(`createAdminClient`)로 우회한다 — `reports_update_admin` RLS 정책은 있지만 테이블 GRANT가 `select, insert`뿐이라 세션 클라이언트의 UPDATE가 42501로 막히기 때문(마이그레이션 GRANT 공백, 코드 주석에 명시). 우회 범위는 처리 컬럼(status·note·resolved_by·resolved_at)으로 한정하고, 호출 전에 반드시 `requirePermission('reports','write')`를 통과한다.
- 처리 메모·기각 사유는 `reports`에 컬럼이 없어 `audit_logs.after.note`에만 저장된다 — 감사 로그가 사실상 처리 기록의 원본이다.
- "같은 대상 함께 처리/기각" 체크를 켜면 현재 신고 건을 포함해 그 대상의 **미처리(open) 신고 전부**가 한 번에 종결된다.
- 조치(숨김·삭제·정지)가 실패하면 신고 상태를 바꾸지 않는다(조치 없이 종결되는 것을 막음). 반대로 조치는 성공했는데 `reports` 상태 변경이 실패하면, 이미 적용된 조치는 되돌리지 않고 "신고가 미처리로 남아 있는지 확인해 달라"는 안내만 보여 준다.
- 정지 규칙은 회원 모듈과 공유한다: 자기 자신 정지 불가, 관리자 계정 정지 불가(먼저 권한 회수 필요), 개인정보가 파기된 계정은 정지 대상에서 제외.
- `report.resolve`/`report.dismiss`는 `admin/components/audit/audit-labels.ts`의 `DOMAIN_LABELS`('신고')·`VERB_LABELS`('처리'/'기각')에 정상 매핑되어 있다(뉴스·커뮤니티 도메인과 달리 라벨 누락 없음).
