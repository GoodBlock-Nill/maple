# 정지 · 정지 해제 (`/members/[id]` 다이얼로그)

**목적** 회원의 쓰기 권한을 기간제로 막고, 해제한다. 정지는 "읽기는 되고 쓰기만 막힌다" — 계정을 지우거나 로그인을 끊으면 사용자가 자기 글·문의 내역을 확인할 수 없어 이의 제기 경로까지 함께 사라진다(마이그레이션 `20260908001700` §2).

**데이터 출처** 다이얼로그 자체는 조회하지 않는다. 액션이 `readMember(memberId)`(`admin/lib/actions/member-shared.ts`) 로 스냅샷(`id`·`nickname`·`email`·`role`·`suspended_until`·`suspension_reason`·`deleted_at`·`purged_at` …)을 읽어 감사 로그의 `before` 로 쓴다.

## 3.1 정지 다이얼로그 (`MemberSuspendDialog`)

트리거 버튼은 danger·sm. 라벨은 정지 중이면 "정지 기간 변경", 아니면 "정지".
다이얼로그 제목 `{닉네임} 님 정지`, 설명 "정지된 회원은 글·댓글·신고·좋아요를 남길 수 없습니다. 열람은 그대로 가능합니다."

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값·프리필 | 동작 / 상호작용 |
|---|---|---|---|---|
| memberId | hidden | `z.uuid()` — 실패 시 "대상 회원을 찾을 수 없습니다."(`suspendMemberSchema.memberId`) | 현재 회원 id | 액션이 자기 자신·관리자·파기 계정을 다시 확인한다 |
| 기간 | 라디오 5개 `name="period"` | `z.enum(SUSPENSION_PERIODS)` = `1`·`3`·`7`·`30`·`permanent`. 실패 시 "정지 기간을 선택해 주세요." | **`3`(3일)** — 배열의 두 번째 항목이 `defaultChecked` | 라벨·임의 날짜 미지원 이유(아래) |
| 사유 | 텍스트 입력 `name="reason"` | 필수·최대 200자(아래) | 빈 칸 | placeholder·hint(아래) |
| 취소 | 버튼(secondary) | 진행 중 비활성 | — | 다이얼로그 닫기(저장 안 함) |
| 정지 | submit(danger) | 진행 중 비활성 | — | `suspendMemberAction` 실행(아래) |
| 폼 오류 배너 | `FormBanner` | — | — | `state.formError` 를 다이얼로그 **안에** 표시(토스트 아님). 다이얼로그는 닫히지 않는다 |

**동작 상세**
- **기간** — 라벨: 1일 / 3일 / 7일 / 30일 / 영구. **임의 날짜 입력은 열지 않는다** — 사람마다 다른 "언제까지"가 나오면 같은 위반에 다른 제재가 나가고 기록을 모아도 기준을 재구성할 수 없다.
- **사유(필수·제한)** — 필수 1자 이상("사유를 입력해 주세요."), 최대 200자(`SUSPENSION_REASON_MAX`, "사유는 200자 이하로 입력해 주세요."). `.trim()` 후 판정.
- **사유(동작)** — placeholder "예: 반복적인 욕설로 신고 3건 누적". hint "사용자 화면의 정지 안내 배너에 “사유: …” 로 그대로 붙습니다. 한 줄로 읽히도록 40자 이내를 권합니다." → `profiles.suspension_reason`.
- **정지** — `suspendMemberAction` → 성공 시 토스트 "회원을 정지했습니다." + 다이얼로그 닫힘. 진행 중 라벨 "정지 중…".

**기간 계산** `suspensionUntil(period)` = `now + N일`(밀리초 덧셈). 자정 기준으로 끊지 않는다 — 23:59 에 받은 1일 정지가 1분 만에 풀리면 제재 길이가 접수 시각에 따라 달라진다. `permanent` 는 `PERMANENT_SUSPENSION_UNTIL = '9999-12-31T00:00:00.000Z'`(`suspended_until` 이 nullable 이라 "무한대"를 담을 수 없다).

**액션 경로** `suspendMemberAction`(`admin/lib/actions/members-actions.ts`)
1. `suspendMemberSchema.safeParse()` → 실패 시 `fieldErrors`(필드 옆 표시).
2. `suspendMember(memberId, period, reason)` — `requirePermission('members','write')` → 자기 자신 / `role='admin'` / `purged_at` 검사.
3. `profiles.update({ suspended_until, suspension_reason }).eq('id', memberId)` — 세션 클라이언트(RLS `profiles_update_admin`).
4. 감사 `member.suspend`(before: 이전 `suspended_until`·`suspension_reason`, after: 새 값 + `period`), targetTable `profiles`.
5. `revalidateMember(memberId)` → `/members`, `/members/{id}`. **사용자 사이트 캐시 태그는 없다.**

## 3.2 정지 해제 (다이얼로그 없음)

`MemberActions` 안의 작은 폼이다. 되돌리기 어려운 조작이 아니므로 확인 단계를 두지 않는다.

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 동작 / 상호작용 |
|---|---|---|---|
| memberId | hidden | `unsuspendMemberSchema.memberId` = `z.uuid()` | — |
| 정지 해제 | submit(secondary·sm) | `isSuspended(suspendedUntil)` 일 때만 렌더. 진행 중 비활성 + 라벨 "해제 중…" | `unsuspendMemberAction` 실행(아래) |
| 결과 | 토스트 | — | 성공/실패 문구(아래) |

**동작 상세**
- **정지 해제** — `unsuspendMemberAction` → `suspended_until=null`·`suspension_reason=null` → 감사 `member.unsuspend` → `revalidateMember()`.
- **결과** — 성공 `{닉네임} 님의 정지를 해제했습니다.`(success) · 실패 `state.formError`(error). 이 버튼만 실패도 **토스트**로 띄운다(다이얼로그가 없어 배너를 걸 자리가 없다).

## 3.3 신고 처리에서 오는 같은 경로

`/reports` 의 신고 처리에서 조치로 "작성자 정지"(`REPORT_ACTION_LABEL.suspend`)를 고르면 `resolveReportSchema` 가 `period`·`suspensionReason` 을 함께 요구하고(`superRefine`), 같은 `suspendMember()` 를 부른다(`admin/lib/actions/reports-actions.ts`). 따라서 정지 기간·사유 상한이 두 화면에서 같다. 성공하면 `/members/{작성자id}` 도 함께 `revalidatePath` 된다.

## 상태·뱃지 의미

| 값 | 화면 | 의미 |
|---|---|---|
| `suspended_until is null` | 뱃지 "정상"(success), 프로필 카드 "정지 종료" `-` | 제재 없음 |
| `suspended_until > now()` | 뱃지 `정지 ~2026-09-20`(danger) | 진행 중. `isSuspended()` 판정 |
| `suspended_until` 연도 ≥ 9999 | 뱃지 "정지 영구"(danger) | `isPermanentSuspension()` |
| `suspended_until <= now()` | 뱃지 "정상" | 기간이 지났다(아래) |
| `role='admin'` | 뱃지 "관리자"(accent) | 정지 여부와 무관하게 관리자로 표시 — 관리자에게는 제재가 실효를 갖지 않는다 |

- **`suspended_until <= now()`** — 값은 남아 있고(프로필 카드 "정지 종료"에 과거 시각이 보인다) 자동으로 지워지지 않는다.

## 클라이언트와의 상호작용

- **판정** 사용자 사이트는 세션마다 `profiles.suspended_until`·`suspension_reason` 을 읽는다(`getCurrentUser()`, `lib/auth/current-user.ts`). RLS `profiles_select_self` 라 **남의 정지 상태는 이 경로로 알 수 없다**.
- **문구** `describeSuspension()`(`lib/utils/suspension.ts`) 이 만든다. 여기 적은 사유가 그대로 붙는다.
  - `정지된 계정입니다 (2026-09-11까지 · 사유: 욕설·비방)`
  - `정지된 계정입니다 (영구 정지 · 사유: 욕설·비방)`
  - 사유가 비어 있으면 `정지된 계정입니다 (2026-09-11까지)`
- **배너** `SuspensionNotice`(`components/board/SuspensionNotice.tsx`) — 빨간 박스 + 둘째 줄 "정지 기간에는 글쓰기 · 댓글 · 신고 · 좋아요를 이용할 수 없습니다. 문의는 고객지원에서 접수해 주세요."(고객지원은 `/support` 링크). 좁은 자리(`compact`)에서는 첫 문장을 뺀다.
- **어디에 보이는가** 글쓰기(`/community/write`) · 글 수정(`/community/[id]/edit`) · 글 상세의 댓글 폼·좋아요·신고(`/community/[id]`).
- **서버 강제** 액션(`lib/actions/{post,post-edit,comment-포함 report,like}-actions.ts`)이 `suspensionNotice(user)` 로 먼저 막고, DB 가 최종 방어선이다 — RLS `posts_insert_community`·`comments_insert_own`·`post_likes_insert_own`·`reports_insert_own` 의 `not public.is_suspended()`. 그 사이 정지가 걸려 42501 이 나면 기간을 모르므로 `SUSPENDED_WRITE_MESSAGE`("정지된 계정입니다. 문의는 고객지원에서 접수해 주세요.")로 떨어진다.
- **열람은 그대로** 로그인·마이페이지·문의 접수는 막히지 않는다(이의 제기 경로를 남긴다).
- 반영 시점: 캐시 태그가 없으므로 **사용자의 다음 요청부터** 즉시 적용된다.

## 오류·예외

| 상황 | 문구 | 표시 위치 |
|---|---|---|
| 자기 자신 | "자기 자신을 정지할 수는 없습니다." | 다이얼로그 배너 |
| 없는 회원 | "회원을 찾을 수 없습니다." | 다이얼로그 배너 / 해제는 토스트 |
| `role='admin'` | "관리자 계정은 정지할 수 없습니다. 먼저 관리자 권한을 회수해 주세요." | 다이얼로그 배너 |
| 파기된 계정 | "개인정보가 파기된 계정입니다. 제재를 적용할 대상이 없습니다." | 다이얼로그 배너(아래) |
| DB 실패 | "회원을 정지하지 못했습니다. 정지는 적용되지 않았습니다. 잠시 후 다시 시도해 주세요." | 다이얼로그 배너 |
| 해제 DB 실패 | "정지를 해제하지 못했습니다. 정지는 그대로입니다. 잠시 후 다시 시도해 주세요." | 토스트(error) |

- **파기된 계정** — 실제로는 `MemberActions` 가 렌더되지 않아 UI 로는 닿지 않는다(직접 POST 방어).

- 관리자를 막는 이유: 관리자는 `is_suspended()` 검사를 받는 쓰기 경로가 없어 정지가 실효를 갖지 않는다. 표시만 되고 실제로는 아무것도 막히지 않는 상태를 만들지 않는다.
- 낙관적 잠금은 없다. 두 운영자가 동시에 정지하면 나중 값이 이긴다(감사 로그에 두 건이 모두 남는다).
- 사용자는 자기 `suspended_until` 을 지울 수 없다 — `guard_profile_role()` 이 일반 사용자 분기에서 `suspended_until`·`suspension_reason` 을 이전 값으로 되돌린다.
