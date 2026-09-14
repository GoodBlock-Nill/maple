# 강제 탈퇴 · 개인정보 즉시 파기 (`/members/[id]` 다이얼로그)

**목적** 회원을 탈퇴 상태로 돌려 90일 보존 시계를 시작하고(강제 탈퇴), 필요하면 배치를 기다리지 않고 개인정보를 지운다(즉시 파기). 정지와 **다른 조치다** — 정지는 쓰기만 막지만 이쪽은 계정의 수명을 다룬다.

**데이터 출처** 두 액션 모두 `readMember(memberId)` 로 현재 상태를 읽고 `lifecycleOf()`(`memberLifecycle`)로 판정한다. 규칙의 DB 쪽 강제는 `supabase/migrations/20260909000400_account_withdrawal.sql`.

운영 절차·배치 운용·체크리스트는 `docs/admin/ACCOUNT-WITHDRAWAL-GUIDE.md` 참고(여기서는 화면과 필드만 다룬다).

## 4.1 강제 탈퇴 다이얼로그 (`MemberForceWithdrawDialog`)

노출 조건: write 권한 **and** `lifecycle === 'active'` **and** 본인이 아님.
제목 "강제 탈퇴", 설명 `{닉네임} 회원을 탈퇴 상태로 전환합니다. 90일 후 개인정보가 파기되며, 그 안에 본인이 다시 로그인하면 복구됩니다. 진행 중인 이용 제한은 유지됩니다.` — 세 가지(파기 시점·복구 가능·제재 유지)를 모두 적는 것이 규약이다.

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값 | 동작 / 상호작용 |
|---|---|---|---|---|
| memberId | hidden | `forceWithdrawMemberSchema` = `{ memberId: z.uuid('대상 회원을 찾을 수 없습니다.') }` | 현재 회원 id | — |
| (사유 입력 없음) | — | — | — | 되돌리기 어려운 조작이라 근거는 확인 다이얼로그가 아니라 **감사 로그와 별도 기록**(요청 티켓)에 남아야 한다. 입력칸을 두면 그 칸이 근거의 전부가 된다 |
| 취소 | 버튼(secondary) | 진행 중 비활성 | — | 닫기 |
| 탈퇴 처리 | submit(danger) | 진행 중 비활성, 라벨 "탈퇴 처리 중…" | — | `forceWithdrawMemberAction` |
| 폼 오류 배너 | `FormBanner` | — | — | 다이얼로그 안에 표시 |

**액션 경로** `forceWithdrawMemberAction`(`admin/lib/actions/member-lifecycle-actions.ts`)
1. `requirePermission('members','write')` → 스키마 파싱.
2. 본인 불가 / `role='admin'` 불가 / 이미 `purged` 불가 / 이미 `withdrawn` 불가.
3. `profiles.update({ deleted_at: now })` — **세션 클라이언트**로 쓴다. 서비스 롤을 쓰면 DB 트리거가 남기는 `member.withdraw` 의 행위자가 비어(`auth.uid()` = null) 추적이 끊긴다.
4. 감사 `member.force_withdraw`(before `{deleted_at: null}`, after `{deleted_at, suspended_until}`). 같은 update 로 트리거 `log_profile_lifecycle` 이 `member.withdraw`(행위자 = 운영자)도 남긴다.
5. `revalidateMember()`. 토스트 `{닉네임} 님을 탈퇴 상태로 전환했습니다.`
6. **`suspended_until` 은 건드리지 않는다** — 복구하면 남은 제재가 그대로 적용되어야 "탈퇴로 제재를 피한다"는 길이 막힌다.

## 4.2 개인정보 즉시 파기 다이얼로그 (`MemberPurgeDialog`)

노출 조건: write 권한 **and** `lifecycle === 'withdrawn'` **and** `actor.isSuperAdmin` **and** 본인이 아님.
제목 "개인정보 즉시 파기", 설명 `{닉네임} 님의 개인정보를 90일을 기다리지 않고 지금 파기합니다. 되돌릴 수 없습니다. 작성한 글과 댓글은 남고 '탈퇴한 회원'으로 표시됩니다.` — 앞을 빼면 운영자가 가볍게 누르고, 뒤를 빼면 게시판이 통째로 사라진다고 오해한다.

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 동작 / 상호작용 |
|---|---|---|---|
| memberId | hidden | `purgeMemberSchema` = `{ memberId: z.uuid('대상 회원을 찾을 수 없습니다.') }` | — |
| 취소 | 버튼(secondary) | 진행 중 비활성 | 닫기 |
| 파기 | submit(danger) | 진행 중 비활성, 라벨 "파기 중…" | `purgeMemberNowAction` |
| 폼 오류 배너 | `FormBanner` | — | 다이얼로그 안 |

**액션 경로** `purgeMemberNowAction`
1. `requireSuperAdmin()` — `admins` 모듈 권한과 별개다(권한 체계를 바꾸는 조작은 역할표로 위임하지 않는다).
2. 본인 불가 → 이미 `purged` 불가 → `active` 불가(먼저 탈퇴 처리).
3. `purgeProfile()` — **서비스 롤**(`createAdminClient()`)로 `profiles` 를 한 명분만 갱신:
   `email=null` · `nickname='탈퇴한 회원#{id앞8자}'` · `name=null` · `avatar_url=null` · `provider_id=null` · `msw_uid=null` · `msw_profile_code=null` · `suspended_until=null` · `suspension_reason=null` · `purged_at=now`.
4. `posts.author_name` · `comments.author_name` 을 같은 익명 닉네임으로 갱신. 공개 조회는 `profiles` 를 읽지 못하므로 이 스냅샷이 화면의 유일한 근거다. **실패해도 파기를 되돌리지 않는다**(개인정보는 이미 지워졌고, 되돌리면 더 나쁜 상태가 된다 — 다음 배치가 다시 시도한다).
5. `auth.admin.deleteUser(memberId)`. **실패하면 `purged_at` 을 `null` 로 롤백한다** — 로그인 수단이 남았는데 "파기됨"으로 표시되면 다음 배치가 이 회원을 건너뛰어 이메일이 영영 남는다.
6. 감사 `member.purge`(before: 닉네임·이메일·MSW 값·`deleted_at`, after: 새 닉네임·`purged_at`·`immediate: true`).
7. `revalidateMember()` **+ `revalidateClient(['community-list'])`** — 이 메뉴에서 사용자 사이트 캐시를 태우는 유일한 자리다.
8. 토스트 `{닉네임} 님의 개인정보를 파기했습니다.`

**전량 배치 함수를 쓰지 않는 이유** `public.purge_withdrawn_profiles(p_cutoff)` 는 기준 기간을 넘긴 프로필을 **한꺼번에** 훑는다. 한 명을 지우려고 부르면 아직 기간이 남은 다른 회원까지 파기된다. Edge Function `purge-withdrawn` 도 대상 지정을 받지 않는다(크론 시크릿 + 빈 본문). 그래서 이 액션이 같은 컬럼 목록을 **직접** 들고 있다 — **두 목록은 한 줄씩 같아야 한다**(`purgeProfile()` ↔ `purge_withdrawn_profiles()`).

## 4.3 자동 파기 배치 (화면 밖)

| 요소 | 값 |
|---|---|
| 함수 | `public.purge_withdrawn_profiles(interval '90 days')` — SECURITY DEFINER · `service_role` 전용. `for update skip locked` 로 훑고 처리한 id 를 반환. 감사 로그 `member.purge`(행위자 `null`, after `{purged_at, cutoff}`) |
| 호출자 | Edge Function `supabase/functions/purge-withdrawn/index.ts` — 반환된 id 마다 `auth.admin.deleteUser`. 실패하면 그 프로필의 `purged_at` 을 비워 다음 날 재시도 |
| 인가 | `x-cron-secret` 헤더 == `CRON_SECRET`, 또는 `Authorization: Bearer <SERVICE_ROLE_KEY>`(수동 실행) |
| 스케줄 | pg_cron `purge-withdrawn-daily` `0 18 * * *`(UTC) = 03:00 KST. 시크릿은 Vault `purge_withdrawn_cron_secret` |
| 응답 | `{ ok, purged, authDeleted, pendingAttachmentsRemoved, failed[] }` |

배치는 `deleted_at` 을 비우지 않는다 — 언제 탈퇴했는지가 기록이고, 화면은 `purged_at` 을 먼저 보므로 "탈퇴 대기"로 되읽히지 않는다.

## 상태·뱃지 의미

| 생애주기 | 뱃지 | 상세의 카드 | 콘솔에서 가능한 조치 |
|---|---|---|---|
| `active` | 정상 / 정지 / 관리자 | 생애주기 카드 없음 | 정지·해제·닉네임 변경·강제 탈퇴 |
| `withdrawn` | 탈퇴 대기 D-nn (warn) + 정지 뱃지(있으면) | "탈퇴 대기" 카드 | 정지·해제·닉네임 변경·즉시 파기(슈퍼어드민) |
| `purged` | 삭제됨 (muted, 단독) | "개인정보 파기됨" 카드 | 없음 — `MemberActions` 자체가 렌더되지 않는다 |

## 클라이언트와의 상호작용

### 회원이 스스로 탈퇴하는 경로
- 마이페이지 셸(`components/account/MyPageShell.tsx`)의 구분선 아래 "회원 탈퇴" 행(`WithdrawRow`) — `/account`·`/account/link` 두 화면 모두에 붙는다. 설명 2줄: "탈퇴 후 개인정보는 90일간 보관되며, 이후 삭제됩니다." / "작성한 게시글과 댓글은 삭제되지 않습니다."
- 트리거 → `WithdrawAccountButton` 확인 모달(제목 `WITHDRAW_DIALOG_TITLE` "회원 탈퇴", 본문 `WITHDRAW_DIALOG_DESCRIPTION` — 90일 보존·복구·영구 삭제 대상·글 유지·**제재 유지**를 모두 적는다), 버튼 "탈퇴"/"탈퇴 중…".
- `withdrawAccountAction`(`lib/actions/account-actions.ts`) → 세션 클라이언트로 `deleted_at` 을 찍고 **갱신된 행을 되읽어 확인**(RLS 에 걸려 0행이 바뀌어도 PostgREST 는 오류를 내지 않는다) → `signOut()` → `/?notice=withdrawn` 리다이렉트.
- 홈에서 `WithdrawnNoticeDialog` — 제목 "회원 탈퇴가 완료되었습니다.", 본문 "탈퇴가 접수되었습니다. 90일 안에 다시 로그인하면 계정이 복구됩니다."
- 값은 트리거가 고정한다: `guard_profile_role()` 이 일반 사용자 분기에서 `deleted_at` 을 채울 때 **무조건 `now()`** 로 덮는다(과거 시각으로 파기를 앞당기거나 먼 미래로 영구 보존하는 요청이 통하지 않는다).

### 탈퇴 대기 계정이 사이트를 쓸 때
- 프록시(`proxy.ts`)가 로그인 상태에서 게이트를 건다. 대상 경로:
  - 읽기(GET) `WITHDRAWN_READ_PREFIXES` = `/community/write` · `/account` · `/auth/onboarding` · `/support/inquiries` → `/auth/restore?next=…` 로 리다이렉트.
  - 쓰기(비-GET) `WITHDRAWN_MUTATION_PREFIXES` = `/community` · `/support` · `/account` · `/auth/onboarding` → `403 { error: 'account_withdrawn', restorePath: '/auth/restore' }`(POST 를 리다이렉트하면 본문이 유실된다).
  - `/auth/restore` 자체는 게이트에서 제외된다.
- 공개 읽기(목록·상세·뉴스)는 그대로 열려 있다.
- 최종 방어선은 RLS `not public.is_withdrawn()` — `posts_insert_community`·`posts_update_own`·`comments_insert_own`·`comments_update_own`·`post_likes_insert_own`·`reports_insert_own`·`inquiries_insert_own`·`inquiries_update_own`.
- 마이페이지 세 화면은 `requireAccountSession()`(`lib/auth/account-guard.ts`)이 같은 순서로 한 번 더 본다: 미로그인 → 로그인 / 탈퇴 대기 → 복구 / 온보딩 미완료 → 온보딩.

### 복구 화면 `/auth/restore`
| 요소 | 내용 |
|---|---|
| 제목 | "계정 복구" |
| 본문(복구 가능) | `restoreNotice()` — `탈퇴 후 {N}일이 지났습니다. 계속하면 계정이 복구됩니다. 이용 제한이 있었다면 그대로 적용됩니다.` (`daysSinceWithdrawal()`, 내림) |
| 본문(파기 완료) | `PURGED_ACCOUNT_MESSAGE` — "이 계정의 개인정보는 보존 기간이 지나 이미 파기되었습니다. 복구할 수 없으며, 로그아웃 후 새로 가입할 수 있습니다." |
| 계정 복구 | `canRestoreProfile()`(탈퇴 대기 **and** 파기 전)일 때만 렌더. 폼 POST(`restoreAccountAction`), 진행 중 "복구 중…" |
| 로그아웃 | 항상 렌더 |
| hidden `next` | `sanitizePostAuthPath()` 로 정규화된 복귀 경로 |
| 결과 | `deleted_at = null` → 트리거가 `member.restore`(행위자 = 본인) → `next` 로 리다이렉트. 정상 회원이 주소로 직접 들어오면 바로 `next` 로 보낸다 |
| 실패 | "계정을 복구하지 못했습니다. 탈퇴 상태는 그대로입니다. 다시 시도해 주세요." |

복구로 되돌아오는 것은 **상태값뿐**이다 — 닉네임·월드 계정·제재는 그대로 남아 있었으므로 손댈 것이 없다.

### 파기 이후 사용자 사이트
- 로그인 계정(`auth.users`)이 삭제되어 다시 로그인할 수 없다.
- 작성한 글·댓글은 남고 작성자 이름이 `탈퇴한 회원#{id앞8자}` 로 바뀐다. 사용자 사이트는 이 접두사를 보고 고정 문구 "탈퇴한 회원"으로 그린다.
- `community-list` 태그 재검증으로 목록에 즉시 반영된다.

## 오류·예외

| 상황 | 문구 |
|---|---|
| 강제 탈퇴 — 자기 자신 | "자기 자신을 탈퇴 처리할 수는 없습니다." |
| 강제 탈퇴 — 관리자 | "관리자 계정은 탈퇴 처리할 수 없습니다. 먼저 관리자 권한을 회수해 주세요."(관리자는 `/admins` 의 삭제로 다룬다 — 여기서 탈퇴시키면 역할은 남고 로그인만 막히는 어정쩡한 상태가 된다) |
| 강제 탈퇴 — 이미 파기 / 이미 탈퇴 | "이미 개인정보가 파기된 회원입니다." / "이미 탈퇴 상태인 회원입니다." |
| 강제 탈퇴 — DB 실패 | "회원을 탈퇴 처리하지 못했습니다. 계정은 그대로입니다. 잠시 후 다시 시도해 주세요." |
| 파기 — 자기 자신 | "자기 자신의 개인정보는 이 화면에서 파기할 수 없습니다."(파기는 auth 계정까지 지우므로 진행하는 순간 세션이 끊기고 되돌릴 수단도 사라진다) |
| 파기 — 이미 파기 | "이미 개인정보가 파기된 회원입니다. 더 지울 것이 없습니다." |
| 파기 — 탈퇴 전 | "탈퇴하지 않은 회원입니다. 먼저 탈퇴 처리를 한 뒤에 파기할 수 있습니다." |
| 파기 — DB/auth 실패 | "개인정보를 파기하지 못했습니다. 계정은 그대로입니다. 잠시 후 다시 시도해 주세요."(auth 삭제 실패 시 `purged_at` 롤백) |
| 파기 — 작성자 이름 갱신 실패 | 화면에는 성공으로 보인다. `console.error('[members] 작성자 표시 이름을 갱신하지 못했습니다', …)` 만 남고 다음 배치가 재시도한다 |

- 즉시 파기는 **되돌릴 수 없다**. 실행 전 대상이 맞는지 회원 ID 로 확인한다.
- `profiles.id → auth.users` FK 는 제거되어 있다(`20260909000400` §3). auth 계정을 지워도 익명화된 프로필 행이 남아 글·댓글의 작성자 연결이 끊기지 않는다.
- `purged_at` 은 누구도(관리자 포함) 직접 쓸 수 없다 — `guard_profile_role()` 이 `new.purged_at := old.purged_at` 으로 되돌린다. 서비스 롤과 파기 함수만 첫 분기로 통과한다.
