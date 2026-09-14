# 회원 — 메뉴 개요

> 관리자 콘솔(`admin/`)의 회원 메뉴. 화면 하나당 파일 하나이며, 각 파일이 **섹션 → 필드/컨트롤 하나하나**의 검증·기본값·동작·클라이언트 영향을 적는다.
> 작성 규칙: 코드에서 확인한 사실만 쓴다(파일·함수·스키마 이름을 그대로). 파일 경로는 저장소 루트 기준. 워딩은 "카테고리".

## 0. 한눈에

| 항목 | 값 |
|---|---|
| 경로 | `/members` (하위: `/members/[id]`) |
| 권한 모듈 | `members` — read / write (`admin/lib/auth/permissions.ts`). read 는 목록·상세·활동 탭을 보고, write 는 상세의 조치 버튼(`MemberActions`)이 추가로 보인다. 홈페이지 문의 탭은 `inquiries:read` 를 따로 본다. 개인정보 즉시 파기만 `requireSuperAdmin()` |
| 주요 테이블 | `profiles`(`nickname`·`email`·`provider`/`provider_id`·`role`·`suspended_until`·`suspension_reason`·`msw_uid`·`msw_profile_code`·`marketing_*_opt_out`·`deleted_at`·`purged_at`·`terms_agreed_at`·`privacy_agreed_at`·`age_confirmed_at`). 활동 집계는 `posts`·`comments`·`reports`·`inquiries` |
| 클라이언트 영향 | 캐시 태그 없음이 기본이다 — 사용자 사이트는 세션마다 `profiles` 를 직접 읽는다(`lib/auth/current-user.ts`). **예외는 개인정보 즉시 파기 하나**로, `community-list` 태그를 재검증한다(`admin/lib/revalidate.ts`) |
| 관련 파일 | 페이지 `admin/app/(admin)/members/{page,[id]/page}.tsx` · 컴포넌트 `admin/components/members/*` · 액션 `admin/lib/actions/{members-actions,member-lifecycle-actions,member-shared}.ts` · 조회 `admin/lib/data/{members,member-activity,member-inquiries}.ts` · 검증 `admin/lib/validation/{members,member-status,member-list-params}.ts` · 마이그레이션 `20260908000200`·`20260908001500`·`20260908001700`·`20260909000400` |

## 화면 목록

| 파일 | 화면 | 경로 | 한 줄 설명 |
|---|---|---|---|
| [01-list.md](01-list.md) | 회원 목록 | `/members` | 검색·상태·가입 방식·가입일 필터와 활동 수치 표 |
| [02-detail.md](02-detail.md) | 회원 상세 | `/members/[id]` | 생애주기 카드 · 프로필 카드 15칸 · 지표 카드 5개 · 조치 버튼 |
| [03-suspend-dialog.md](03-suspend-dialog.md) | 정지 · 정지 해제 | `/members/[id]` 다이얼로그 | 기간 프리셋 + 사유로 `suspended_until` 을 채우고 비운다 |
| [04-withdrawal.md](04-withdrawal.md) | 강제 탈퇴 · 즉시 파기 | `/members/[id]` 다이얼로그 | 90일 보존 시계 시작, 슈퍼어드민 전용 즉시 파기, 본인 복구 |
| [05-activity-tabs.md](05-activity-tabs.md) | 활동 탭 | `/members/[id]?tab=` | 게시글 · 댓글 · 신고함 · 신고받음 · 홈페이지 문의 |
| [06-nickname-dialog.md](06-nickname-dialog.md) | 닉네임 강제 변경 | `/members/[id]` 다이얼로그 | 사유를 남기고 `profiles.nickname` 만 바꾼다 |

## 메뉴 공통 규칙

### 권한 · 클라이언트 선택
- 페이지 진입은 `requirePermission('members', 'read')`. 부족하면 `/?error=forbidden` 으로 되돌린다(`admin/lib/auth/require-admin.ts`).
- 쓰기 액션은 UI 를 거치지 않는 직접 POST 로도 호출될 수 있어 **액션마다 다시** `requirePermission('members','write')`(파기만 `requireSuperAdmin()`)를 부른다.
- 조회·쓰기 모두 **세션 클라이언트**를 쓴다. RLS `profiles_select_admin` · `profiles_update_admin`(`20260908000700`)이 관리자에게만 열려 있어, 권한이 사라지면 화면도 함께 빈다. 서비스 롤(`createAdminClient()`)은 **개인정보 즉시 파기 한 곳**에서만 쓴다.

### 생애주기(`admin/lib/validation/member-status.ts`)
```
active ──강제 탈퇴 / 본인 탈퇴──▶ withdrawn ──90일 배치 · 즉시 파기──▶ purged
          ◀──본인 재로그인 후 복구──┘
```
- 판정은 `memberLifecycle({deletedAt, purgedAt})`. **파기가 탈퇴를 이긴다**(`purged_at` 이 있으면 `deleted_at` 이 남아 있어도 `purged`).
- 보존 기간 `PURGE_RETENTION_DAYS = 90`. DB 함수 `purge_withdrawn_profiles()` 기본값·개인정보처리방침과 같은 값이어야 한다.
- **정지는 생애주기와 별개의 축이다.** 탈퇴해도 `suspended_until` 은 유지되고, 복구하면 그대로 적용된다. 파기 때만 비워진다.

### 감사 로그(`admin/components/audit/audit-labels.ts`)
| action | 화면 라벨 | 남기는 주체 |
|---|---|---|
| `member.suspend` | 회원 정지 | `suspendMember()` |
| `member.unsuspend` | 회원 정지 해제 | `unsuspendMemberAction` |
| `member.nickname.force_change` | 회원 닉네임 변경 | `changeNicknameAction` |
| `member.force_withdraw` | 강제 탈퇴 | `forceWithdrawMemberAction` |
| `member.purge` | 개인정보 파기 | `purgeMemberNowAction` · DB 함수 `purge_withdrawn_profiles()`(행위자 null) |
| `member.withdraw` | 회원 탈퇴(본인) | DB 트리거 `log_profile_lifecycle` |
| `member.restore` | 탈퇴 복구(본인) | DB 트리거 `log_profile_lifecycle` |

기록 실패는 본 작업을 되돌리지 않는다(`admin/lib/audit.ts` — 서버 로그만 남는다).

### 캐시 · 시각 표기
- 모든 쓰기 액션은 `revalidateMember(id)`(`admin/lib/actions/member-shared.ts`) 로 `/members` 와 `/members/[id]` 두 경로를 재검증한다. 두 페이지 모두 `dynamic = 'force-dynamic'` 이지만 열려 있는 탭이 갱신된다.
- 사용자 사이트 캐시(`revalidateClient`)는 즉시 파기에서만 부른다(`community-list`).
- 날짜는 전부 한국시간 고정 서식이다(`admin/lib/utils/format-date.ts` — `formatDate` `2026-09-08`, `formatDateTime` `2026-09-08 17:04`). 값이 없으면 `-`.

### 콘솔에 **없는** 조작
- 회원을 관리자로 승격하는 버튼(2026-09-09 제품 결정 — 관리자는 `/admins` 에서 이메일 초대로만 만든다).
- 계정 즉시 삭제. 삭제는 **탈퇴 → 90일 → 파기** 두 단계뿐이다(글·댓글의 작성자 연결을 끊지 않기 위해서).
- 회원의 마케팅 수신거부·실명(`name`)·월드 계정 값 편집. 바꾸는 주체는 본인뿐이고 콘솔은 읽기 전용으로 보여 준다.

생애주기 전반의 운영 절차·배치·체크리스트는 `docs/admin/ACCOUNT-WITHDRAWAL-GUIDE.md` 에 있다(여기서는 화면과 필드만 다룬다).
