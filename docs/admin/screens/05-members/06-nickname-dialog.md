# 닉네임 강제 변경 (`/members/[id]` 다이얼로그)

**목적** 부적절한 닉네임 신고가 들어왔을 때 운영자가 회원의 표시 이름을 직접 바꾼다. 남의 표시 이름을 바꾸는 조치이므로 **사유가 필수**다 — 나중에 항의가 들어왔을 때 확인할 수 있는 유일한 기록이 감사 로그다.

**데이터 출처** 다이얼로그는 상세가 이미 읽은 `member.nickname` 을 프리필로 받는다. 액션은 `readMember(memberId)` 로 현재 값을 다시 읽어 감사 로그의 `before` 로 쓴다.

## 6.1 다이얼로그 (`MemberNicknameDialog`)

트리거 버튼 "닉네임 변경"(secondary·sm). 생애주기가 `purged` 가 아니면 항상 보인다(탈퇴 대기 중에도 가능).
제목 "닉네임 강제 변경", 설명 "이미 작성된 글·댓글의 표시 이름(작성 시점 스냅샷)은 바뀌지 않습니다." — 이 사실을 모르면 운영자가 "바꿨는데 그대로"라고 오해한다.
폼은 `noValidate` 라 브라우저 기본 검증 대신 서버 메시지를 그대로 보여 준다.

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값·프리필 | 동작 / 상호작용 |
|---|---|---|---|---|
| memberId | hidden | `changeNicknameSchema.memberId` = `z.uuid('대상 회원을 찾을 수 없습니다.')` | 현재 회원 id | — |
| 새 닉네임 | 텍스트 입력 `name="nickname"` | 필수·형식(아래) | **현재 닉네임**(`defaultValue`) | hint·저장 필드(아래) |
| 사유 | 텍스트 입력 `name="reason"` | 필수 1자 이상, 최대 200자(`SUSPENSION_REASON_MAX` 재사용 — 정지 사유와 같은 상한) | 빈 칸 | placeholder·hint·저장 위치(아래) |
| 취소 | 버튼(secondary) | 진행 중 비활성 | — | 닫기 |
| 변경 | submit(primary) | 진행 중 비활성, 라벨 "변경 중…" | — | `changeNicknameAction` → 성공 시 토스트 + 다이얼로그 닫힘 |
| 폼 오류 배너 | `FormBanner` | — | — | `state.formError` 를 다이얼로그 안에 표시 |

**동작 상세**
- **새 닉네임(필수·제한)** — 필수. `.trim()` 후 2~12자(`NICKNAME_MIN_LENGTH`/`NICKNAME_MAX_LENGTH`), 정규식 `^[가-힣a-zA-Z0-9_]+$`. DB: 고유 인덱스 `profiles_nickname_key`(`lower(nickname)`), `profiles.nickname not null`.
- **새 닉네임(동작)** — hint "2자 이상, 한글·영문·숫자·밑줄. 커뮤니티 목록·랭킹에서는 앞 두 글자만 남기고 가려 보입니다." → `profiles.nickname`.
- **사유** — placeholder "예: 부적절한 닉네임 신고 접수", hint "사용자에게는 보이지 않습니다. 감사 로그에만 남는 운영 기록입니다." → **DB 컬럼에 저장되지 않는다.** 감사 로그 `after.reason` 에만 실린다.

**검증 제한이 사용자 사이트와 같아야 하는 이유** 관리자가 강제로 바꾼 닉네임도 **당사자가 스스로 다시 입력할 수 있는 값**이어야 한다. 그래서 `admin/lib/validation/members.ts` 의 규칙이 사용자 사이트 `lib/validation/auth.ts` 와 같은 값이다.

**액션 경로** `changeNicknameAction`(`admin/lib/actions/members-actions.ts`)
1. `requirePermission('members','write')` → `changeNicknameSchema.safeParse()`.
2. `readMember()` → 없으면 "회원을 찾을 수 없습니다."
3. 현재 값과 같으면 `fieldErrors.nickname = '지금과 같은 닉네임입니다.'`(불필요한 감사 로그를 만들지 않는다).
4. `profiles.update({ nickname }).eq('id', memberId)` — 세션 클라이언트(RLS `profiles_update_admin`).
5. 감사 `member.nickname.force_change`(before `{nickname}`, after `{nickname, reason}`), targetTable `profiles`.
6. `revalidateMember(memberId)`. 토스트 `닉네임을 {새 닉네임}(으)로 변경했습니다.`(조사는 `josa()` 가 받침에 맞춘다).
7. **`posts.author_name` · `comments.author_name` 은 건드리지 않는다** — 작성 시점 스냅샷이다.

## 상태·뱃지 의미

이 다이얼로그에는 상태 값이 없다. 변경 결과는 프로필 카드 헤더·목록의 닉네임 칸과 페이지 제목에 바로 반영된다(`revalidateMember()`).

## 클라이언트와의 상호작용

- 같은 컬럼을 회원 본인도 바꾼다: 마이페이지 `/account` 의 "계정 관리" 카드 → `NicknameField` → `updateNicknameAction`(`lib/actions/profile-actions.ts`). 성공 문구는 입력 아래 한 줄 "닉네임을 변경했습니다."이고 `refresh()` 로 헤더 닉네임까지 갱신된다. 즉 **운영자가 바꿔도 회원이 다시 바꿀 수 있다**(잠그는 장치는 없다).
- 바뀐 닉네임은 사용자 세션이 다음 요청 때 읽는다(`getCurrentUser()`). 캐시 태그 없음.
- **이미 쓴 글·댓글의 표시 이름은 바뀌지 않는다.** 공개 조회는 `profiles` 를 읽지 못하고 `author_name` 스냅샷만 본다. 스냅샷을 일괄로 바꾸는 경로는 개인정보 파기(`renameAuthorSnapshots()`)뿐이다.
- 커뮤니티 목록·랭킹 등에서는 닉네임이 앞 두 글자만 남고 가려져 보인다.

## 오류·예외

| 상황 | 문구 | 표시 위치 |
|---|---|---|
| 형식 위반 | 길이·문자 종류별 문구(아래) | 입력 옆(`fieldErrors.nickname`) |
| 사유 누락·초과 | "사유를 입력해 주세요." / "사유는 200자 이하로 입력해 주세요." | 입력 옆 |
| 같은 값 | "지금과 같은 닉네임입니다." | 입력 옆 |
| 중복(대소문자 무시) | "이미 사용 중인 닉네임입니다." — PostgreSQL `23505`(`UNIQUE_VIOLATION`)를 옮겨 적는다 | 입력 옆 |
| 없는 회원 | "회원을 찾을 수 없습니다." | 다이얼로그 배너 |
| DB 실패 | "닉네임을 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요." | 다이얼로그 배너 |

- **형식 위반** — "닉네임은 2자 이상이어야 합니다." / "닉네임은 12자 이하여야 합니다." / "닉네임은 한글·영문·숫자·밑줄만 사용할 수 있습니다."
- 파기된 계정에는 `MemberActions` 자체가 렌더되지 않으므로 이 다이얼로그를 열 수 없다. 파기 배치가 넣는 `탈퇴한 회원#{id앞8자}` 는 닉네임 규칙(공백·`#` 불가)과 충돌하지 않아 고유 인덱스도 만족한다.
- 낙관적 잠금은 없다. 두 운영자가 동시에 바꾸면 나중 값이 이긴다(감사 로그에 두 건이 남는다).
