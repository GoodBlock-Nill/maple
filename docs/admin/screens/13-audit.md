# 감사 로그 — 화면·기능 설명

> 관리자 콘솔(`admin/`)의 감사 로그 메뉴. 경로 · 권한 · 화면 구성 · 동작(서버 액션) · 클라이언트(사용자 사이트)와의 상호작용을 개발 참고용으로 정리한다.
> 작성 규칙: 코드에서 확인한 사실만 쓴다. 파일 경로는 저장소 루트 기준. 워딩은 "카테고리"(말머리 금지).

## 0. 한눈에

| 항목 | 값 |
|---|---|
| 경로 | `/audit` |
| 권한 모듈 | `audit` — read (쓰기 등급 없음 — 화면·액션 모두 읽기 전용) |
| 주요 테이블 | `audit_logs`(INSERT 정책만 존재, UPDATE/DELETE 정책 없음 — 추가 전용) |
| 클라이언트 영향 | 없음(관리자 전용 데이터) |
| 관련 파일 | `admin/app/(admin)/audit/page.tsx`, `admin/components/audit/*`, `admin/lib/data/audit.ts`, `admin/lib/audit.ts` |

## 1. 감사 로그 (`/audit`)

**목적** 관리자의 모든 변경 이력을 조회한다(수정·삭제 불가, 추가 전용).

**화면 구성**
- 필터(`AuditFilters`, GET 폼): 관리자(행위자, 최근 로그에서 실제 등장한 후보만), 대상 테이블, 행동(action), 시작일/종료일(KST 하루 경계로 환산), 대상 ID(부분 일치).
- 표(`AuditTable`): 시각, 관리자(닉네임 + 이메일, 탈퇴 계정은 "(삭제된 계정)"), 행동(한글 라벨), 대상(테이블 라벨 + ID, 매핑된 관리 화면이 있으면 링크), 변경 요약. `<details>`로 펼치면 변경 전/변경 후 JSON 전체를 볼 수 있다.
- 페이지 크기 `AUDIT_PAGE_SIZE`(50).

**동작(서버 액션)**
이 화면에는 쓰기 액션이 없다. 기록은 각 모듈의 서버 액션이 공통 헬퍼 `writeAuditLog(actorId, entry)`(`admin/lib/audit.ts`)를 호출해 남긴다 — 세션 클라이언트로 insert하며, `audit_logs_insert_admin` RLS 정책이 `actor_id = auth.uid()`를 강제하므로 **남의 이름으로 로그를 위조할 수 없다**. 기록 실패는 본 작업을 되돌리지 않는다(서버 로그에만 남긴다).

**표기 규칙**(`admin/components/audit/audit-labels.ts`, `audit-diff.ts`)
- `action`은 "영역.동작" 조합으로 읽는다: 앞부분은 `DOMAIN_LABELS`(예: `gacha`→확률형 아이템), 뒷부분은 `VERB_LABELS`(예: `create`→등록)로 조합한다. 표에 없는 조합은 원문 그대로 보여준다(잘못 번역하는 것보다 낫다는 원칙). `member.withdraw`(회원 탈퇴·본인)처럼 조합으로는 뜻이 갈리는 예외는 `ACTION_LABELS`에 직접 등록돼 있다.
- `target_table`은 `TABLE_LABELS`로 한글 표기하고, `auditTargetHref(table, id)`가 매핑된 관리 화면 링크를 만든다(`gacha_items`→`/gacha/[id]`, `rankings`→`/rankings`, `site_settings`/`hero_banners`→`/settings`, `profiles`→`/members/[id]`, `admin_invites`→`/admins` 등). 매핑이 없으면 링크 없이 ID만 표시한다.
- 변경 요약(`summarizeAuditDiff`)은 `before`/`after`에서 **바뀐 키만** 골라 최대 3개까지 보여주고 나머지는 "외 N건"으로 줄인다. 필드 이름은 `FIELD_LABELS`로 옮기고(없으면 원문 컬럼명), 값은 40자 넘으면 말줄임표로 자른다.
- 민감 필드 마스킹(`redactSensitive`): 키 이름에 `password`/`token`/`secret`/`api-key` 계열이 들어가면 **값 자체를 `***`로 치환**한다. 값이 아니라 키 이름으로 판단한다(값 형식은 새 케이스마다 규칙이 새기 쉽다).

**클라이언트와의 상호작용**
없음. `audit_logs`는 사용자 사이트가 읽지 않는 관리자 전용 테이블이라 `revalidateClient()`를 호출하지 않는다.

**주의**
- `audit_logs`에는 UPDATE/DELETE 정책 자체가 없다 — 화면에서도 수정·삭제 경로를 만들지 않는다.
- 필터 후보(관리자·테이블·행동)는 고정 목록이 아니라 최근 로그 최대 `OPTION_SCAN_LIMIT`(1000)건에서 실제로 쓰인 값만 모은다. 그보다 오래전에만 등장한 값은 드롭다운에 나타나지 않을 수 있다.
- `actor_id`는 탈퇴 계정이면 FK가 `on delete set null`이라 로그 자체는 남지만 행위자 표시는 "(삭제된 계정)"이 된다.
