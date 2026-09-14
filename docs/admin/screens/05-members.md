# 회원 — 화면·기능 설명

> 관리자 콘솔(`admin/`)의 회원 메뉴. 경로 · 권한 · 화면 구성 · 동작(서버 액션) · 클라이언트(사용자 사이트)와의 상호작용을 개발 참고용으로 정리한다.
> 작성 규칙: 코드에서 확인한 사실만 쓴다. 파일 경로는 저장소 루트 기준. 워딩은 "카테고리"(말머리 금지).

## 0. 한눈에

| 항목 | 값 |
|---|---|
| 경로 | `/members` (하위: `/members/[id]`) |
| 권한 모듈 | `members` — read / write. 탭에 따라 `inquiries`·`coupons` 읽기 권한도 함께 본다(`admin/lib/auth/permissions.ts`) |
| 주요 테이블 | `profiles`, 활동 집계용 `posts`·`comments`·`reports`·`inquiries`·`coupon_redemptions` |
| 클라이언트 영향 | 캐시 태그 없음(회원 데이터는 사용자 세션마다 직접 읽는다). 단, 즉시 파기 시 `community-list` 태그 재검증 |
| 관련 파일 | `admin/app/(admin)/members/{page,[id]/page}.tsx`, `admin/components/members/*`, `admin/lib/{actions,data,validation}/member*.ts` |

## 1. 회원 목록 (`/members`)

**목적** 전체 회원을 검색·필터링하고 상세로 이동한다.

**화면 구성**
- 필터(`MemberFilters`, GET 폼): 검색(닉네임·이메일 동시 검색), 상태(정상/정지/탈퇴 대기/삭제됨/관리자), 가입 방식(카카오/구글/네이버/이메일), 가입 시작일·종료일(KST 기준).
- 숨은 필터: `msw`(월드 계정 UID·프로필 코드 정확 일치). 검색 폼에는 노출되지 않고 상세 화면의 "중복 검색" 링크로만 켜진다. 켜져 있으면 안내 문구와 "해제" 링크가 표에 표시된다.
- 표 열: 닉네임(아바타·공급자 마크), 이메일(마스킹), 가입일, 글 수, 댓글 수, 신고당함(0 초과면 강조), 상태(뱃지 + 탈퇴 대기 행은 파기 예정일 표시).
- 정렬: `created_at`, `nickname`. 페이지네이션 20건/페이지(`DEFAULT_PAGE_SIZE`).

**동작(서버 액션)**
이 화면 자체에는 쓰기 액션이 없다(목록·검색뿐). 각 행의 조치는 상세 화면(§2)에서 이뤄진다.

**클라이언트와의 상호작용**
- `profiles` 는 `profiles_select_admin` RLS 로 관리자만 전체 조회한다. 세션 클라이언트로 읽으므로 로그인한 운영자의 권한이 사라지면 화면도 함께 빈다.
- 사용자 사이트에는 이 목록에 대응하는 화면이 없다(관리자 전용).

**주의**
- 상태 필터는 서로 배타적이지 않다("탈퇴 대기이면서 정지"인 회원은 양쪽 필터에서 모두 나온다). 단 `normal` 만은 탈퇴·파기·관리자를 모두 제외한다.
- `msw` 필터는 부분 일치가 아니라 정확 일치다(UID는 `eq`, 프로필 코드는 대소문자 무시 `ilike` 로 정확 매치).
- 활동 수치(글/댓글/신고당함)는 페이지 단위로 집계하며(`countActivity`, `admin/lib/data/member-activity.ts`) PostgREST 응답 상한(1000행)을 넘으면 잘릴 수 있다. 정확한 값은 상세 화면에서 `count: 'exact'` 로 다시 센다.

## 2. 회원 상세 (`/members/[id]`)

**목적** 한 회원의 프로필 · 생애주기 상태 · 활동을 확인하고 제재·탈퇴·파기 등 조치를 적용한다.

**화면 구성**
- `MemberLifecycleCard`: 정상 회원에게는 그리지 않는다. 탈퇴 대기/파기 상태일 때만 탈퇴일·파기 예정일(D-day)·파기일을 보여준다.
- `MemberProfileCard`: 회원 ID, 이름, 가입일, 최근 수정일, 가입 방식, 공급자 ID, 권한, MSW UID·프로필 코드(+ "중복 검색" 링크), 마케팅 수신거부, 쿠폰 등록 건수(`coupons:read` 있을 때만), 약관/개인정보 동의 시각, 만 14세 확인 시각, 정지 종료·사유. **파기된 계정**은 이메일·이름·공급자 ID·MSW 값·마케팅 수신거부 칸을 아예 그리지 않는다(빈 칸 대신 생략).
- `MemberActions`(쓰기 권한자만): 정지/정지 기간 변경, 정지 해제(정지 중일 때만), 닉네임 강제 변경, 강제 탈퇴(생애주기 `active`이고 본인이 아닐 때만), 개인정보 즉시 파기(생애주기 `withdrawn`, 슈퍼어드민, 본인이 아닐 때만). 회원을 관리자로 승격하는 조작·계정 직접 삭제 버튼은 없다(관리자 초대는 `/admins`, 삭제는 탈퇴→90일→파기 2단계뿐).
- 지표 카드 5개: 게시글, 댓글, 접수한 신고, 받은 신고(0 초과 시 danger 톤), 홈페이지 문의.
- `MemberActivityPanel`: 탭 `posts`/`comments`/`reports-made`/`reports-received`/`inquiries`(URL `?tab=` 로 상태 유지). 각 탭 최근 `ACTIVITY_LIMIT`(20)건. 문의 탭은 `inquiries:read` 없으면 "문의 조회 권한이 없습니다" 안내만 보여준다. 표시 건수보다 실제 건수가 많으면 `/inquiries?user=<id>` 로 "전체 보기" 링크.

**동작(서버 액션)**

| 동작 | 액션 함수 | 검증 | DB 변경 | 감사 로그 | 클라이언트 영향 |
|---|---|---|---|---|---|
| 정지 | `suspendMemberAction`/`suspendMember` (`admin/lib/actions/members-actions.ts`) | zod `suspendMemberSchema`(memberId, period 1/3/7/30/permanent, reason 필수) | `profiles.suspended_until`, `profiles.suspension_reason` | `member.suspend` | 없음(사용자 세션이 다음 요청 시 반영) |
| 정지 해제 | `unsuspendMemberAction` | zod `unsuspendMemberSchema` | `profiles.suspended_until=null`, `suspension_reason=null` | `member.unsuspend` | 없음 |
| 닉네임 강제 변경 | `changeNicknameAction` | zod `changeNicknameSchema`(nickname 2~12자 한글/영문/숫자/밑줄, reason 필수) | `profiles.nickname` | `member.nickname.force_change` | 없음(게시글·댓글 `author_name` 은 작성 시점 스냅샷이라 갱신 안 함) |
| 강제 탈퇴 | `forceWithdrawMemberAction` (`admin/lib/actions/member-lifecycle-actions.ts`) | zod `forceWithdrawMemberSchema`. 본인 불가, 관리자 계정 불가, 이미 탈퇴/파기 상태 불가 | `profiles.deleted_at` | `member.force_withdraw` | 없음. 사용자가 재로그인하면 상태만 복구(§주의) |
| 개인정보 즉시 파기 | `purgeMemberNowAction` | zod `purgeMemberSchema`. **슈퍼어드민 전용**(`requireSuperAdmin`). 본인 불가, 생애주기 `withdrawn` 아니면 불가 | `profiles.{email,nickname,name,avatar_url,provider_id,msw_uid,msw_profile_code,suspended_until,suspension_reason,purged_at}` 를 서비스 롤로 갱신 + `posts.author_name`/`comments.author_name` 갱신 + `auth.admin.deleteUser` | `member.purge` | 태그 `community-list` 재검증(작성자 표시 이름 변경 즉시 반영) |

**클라이언트와의 상호작용**
- 정지: 사용자 사이트는 세션마다 `profiles.suspended_until` 을 직접 읽는다. 정지된 사용자는 글·댓글·신고·좋아요를 남길 수 없지만 열람은 가능하다(안내 배너에 사유가 그대로 노출된다).
- 강제 탈퇴 → 90일 보존 기간(`PURGE_RETENTION_DAYS`) 동안 개인정보는 남아 있고, 본인이 다시 로그인하면 `/restore` 화면으로 안내되어 복구를 확정하면 `deleted_at` 이 비워진다(`restoreAccountAction`, `lib/actions/account-actions.ts`; 트리거 `log_profile_lifecycle` 이 `member.restore` 감사 로그를 남긴다). **진행 중인 이용 제한(정지)은 탈퇴·복구와 무관하게 유지**된다.
- 즉시 파기 → `auth.admin.deleteUser` 로 로그인 계정 자체가 삭제되어 해당 사용자는 다시 로그인할 수 없다. 작성한 글·댓글은 남고 작성자 이름이 `탈퇴한 회원#<id앞8자>` 로 즉시 바뀐다(캐시 재검증 있음).
- 홈페이지 문의 탭 ↔ `/inquiries`: 같은 문의를 관리자 상세(`/inquiries/[id]`)에서도 볼 수 있다. 취소된 문의(`cancelled_at` not null)는 지표·탭·목록 어디에서도 제외된다.
- 쿠폰 등록 건수 ↔ `/coupons/[id]` 등록 내역: 숫자만 표시하고 링크는 없다(회원 기준으로 좁혀 보는 쿠폰 목록 화면이 없기 때문).

**주의**
- `role='admin'` 계정은 정지·강제 탈퇴 둘 다 막힌다("먼저 관리자 권한을 회수해 주세요" 안내). 관리자는 `is_suspended()` RLS 검사를 받는 쓰기 경로가 없어 정지가 실효를 갖지 않기 때문이다.
- 파기된 계정(`purged_at` not null)에는 `MemberActions` 자체가 렌더링되지 않는다(더 걸 조치가 없다).
- 즉시 파기는 되돌릴 수 없다. auth 계정 삭제가 실패하면 `purged_at` 을 롤백해 "파기됨" 표시와 실제 로그인 가능 여부가 어긋나지 않게 한다.
- 파기 배치(90일 경과, `purge-withdrawn` Edge Function)와 즉시 파기는 지우는 컬럼이 한 줄씩 같아야 한다(코드 주석 상 명시적 제약). 자세한 생애주기 규칙은 `docs/admin/ACCOUNT-WITHDRAWAL-GUIDE.md` 참고.
