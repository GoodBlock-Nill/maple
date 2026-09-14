# 관리자 — 초대 다이얼로그 (`InviteAdminDialog`)

**목적** 이메일 주소와 역할을 정해 초대 메일을 보낸다. 받은 사람이 링크에서 **스스로** 비밀번호를 정하면 관리자가 된다. 여기서 비밀번호를 대신 정하지 않는 이유: 운영자가 만든 비밀번호는 어딘가(메신저·메모)에 평문으로 남는다.

**데이터 출처** 페이지가 읽어 둔 `roleOptions`(= `getAdminRoles()` 결과를 `{ value: id, label: name }` 로 변환)만 쓴다. 초대 대상의 기존 계정 여부는 액션이 실행 시점에 조회한다.

## 1.1 다이얼로그

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값 | 동작 / 상호작용 |
|---|---|---|---|---|
| 관리자 초대 | 버튼(헤더 action) | **역할이 하나도 없으면 비활성**(`roleOptions.length === 0`) | — | 다이얼로그를 연다 |
| 제목 | 고정 문구 | — | `관리자 초대` | — |
| 설명 | 고정 문구 | — | "입력한 주소로 초대 메일이 갑니다. 받은 사람이 링크에서 비밀번호를 직접 정합니다." | — |
| 이메일 | `type="email"`, `autoComplete="off"`, `autoFocus`, `maxLength=254` | **필수.** `inviteAdminSchema.email`: trim → 1자 이상("이메일을 입력해 주세요.") → ≤254자(`EMAIL_MAX_LENGTH`, "이메일은 254자를 넘을 수 없습니다.") → `z.email('이메일 형식이 올바르지 않습니다.')` | 빈 값 | **제어 입력**이다 — 액션이 끝나면 React 가 폼을 초기화하므로, 오류가 났을 때 운영자가 쓴 주소가 지워지지 않게 값을 붙잡아 둔다 |
| 역할 | 셀렉트 | **필수.** `z.uuid('역할을 선택해 주세요.')` | `roleOptions[0].value`(목록 첫 역할 = 시스템 역할 우선 정렬이라 보통 슈퍼어드민) | `admin_invites.role_id` 로 저장되고, 가입 시 트리거가 `profiles.admin_role_id` 로 옮긴다. **기본값이 슈퍼어드민일 수 있으니 확인하고 보낸다** |
| 폼 오류 배너 | `FormBanner` | — | 없음 | `formError` 를 다이얼로그 안에 표시(닫히지 않는다) |
| 취소 | 버튼(secondary) | 진행 중 비활성 | — | 닫기만 |
| 초대 메일 보내기 | 제출 버튼 | 진행 중 `보내는 중…` | — | `inviteAdminAction`. 성공 시 토스트 + 다이얼로그 닫힘 |

폼은 `noValidate` — 브라우저 기본 말풍선 대신 다른 폼과 같은 한국어 필드 오류를 보여 준다.

## 1.2 서버 동작 (`inviteAdminAction`)

| 단계 | 내용 |
|---|---|
| 권한 | `requireSuperAdmin()` |
| 검증 | `inviteAdminSchema`(email + roleId) |
| 역할 확인 | `admin_roles` 조회 → 없으면 `roleId` 필드 오류 "역할을 찾을 수 없습니다." |
| 기존 계정 확인 | `profiles` 를 `ilike('email', …)` 로 조회. 있으면 거절 — `EXISTING_USER_MESSAGE`: "이미 계정이 있는 이메일입니다. 관리자 목록에서 역할을 지정하거나 삭제 후 다시 초대해 주세요." **조용한 승격은 "초대를 수락했다"는 사실 없는 권한 부여라 나중에 그 사람이 어떻게 관리자가 됐는지 설명할 수 없다** |
| 초대 행 | `upsertPendingInvite()` — 같은 이메일 행이 있으면 `pending` 으로 되살리고(`role_id`·`invited_by`·`expires_at` 갱신, `accepted_at = null`), 없으면 insert. `expires_at = now + INVITE_TTL_MS`(7일). `upsert()` 를 못 쓰는 이유: 유니크 인덱스가 `lower(email)` 이라는 **식**이라 `on conflict (email)` 과 맞지 않는다. 실패하면 "초대를 기록하지 못했습니다. 메일은 보내지 않았습니다. 다시 시도해 주세요." |
| 메일 발송 | 서비스 롤(`createAdminClient()`)로 `auth.admin.inviteUserByEmail(email, { redirectTo: adminSiteUrl() + '/auth/callback?next=%2Finvite%2Faccept' })` |
| 발송 실패 보상 | 방금 만든 초대 행을 `status='revoked'` 로 되돌린다 — 메일이 나가지 않은 초대 행을 남기면 **그 주소로 가입하는 누구나 관리자가 된다.** 문구: "초대 메일을 보내지 못했습니다. 초대는 취소되었습니다. 주소를 확인하고 다시 시도해 주세요." |
| 감사 | `admin.invite` · `target_table='admin_invites'` · `target_id=초대 id` · after `{ email, role: role.key }` |
| 갱신 | `revalidatePath('/admins')` |
| 성공 | 토스트 `{이메일} 으로 초대 메일을 보냈습니다.` |

**순서가 중요하다 — 반드시 "초대 행 → 메일"** `inviteUserByEmail()` 이 메일을 보내는 순간 `auth.users` 행이 생기고 `handle_new_user()` 트리거가 돌아 초대 행을 찾는다. 반대로 하면 초대받은 사람이 **일반 사용자로** 만들어진다.

## 1.3 승격이 일어나는 지점 (DB 트리거)

| 항목 | 내용 |
|---|---|
| 함수 | `public.handle_new_user()`(`supabase/migrations/20260908001700_admin_foundation.sql`, `20260909000200_admin_roles.sql` 에서 역할까지 확장) |
| 근거 | `admin_invites` 의 **`pending` 且 만료 전** 행 하나. `role` 은 `raw_user_meta_data` 에서 절대 읽지 않는다(읽으면 클라이언트가 `signUp` 옵션에 `role:'admin'` 을 실어 스스로 관리자가 될 수 있다) |
| 결과 | `profiles.role = 'admin'` + `admin_role_id = 초대의 role_id`, 같은 트랜잭션에서 초대를 `accepted` 로 닫는다 — **초대장 하나가 두 계정을 관리자로 만들 수 없다** |
| 시점 | 초대 메일을 **보낸 순간**(가입 완료 시점이 아니다) |

## 1.4 상태 흐름

`admin_invites.status`: `pending`(발송) → `accepted`(가입 완료, 트리거가 닫음) | `revoked`(취소·발송 실패 보상·관리자 삭제 시). 목록에는 `pending` 만 보인다. DELETE 정책이 없어 행 자체는 영구히 남는다(초대 이력).

**클라이언트와의 상호작용**

- 사용자 사이트와 무관하다. 초대 링크는 관리자 앱 자신(`NEXT_PUBLIC_ADMIN_URL`, 미설정 시 `http://localhost:3100`)을 가리킨다.
- 링크를 탄 뒤 흐름: `/auth/callback` → 세션 확립 + `profiles.role === 'admin'` 확인 → `/invite/accept` 에서 비밀번호 설정 → 대시보드(`14-auth/` 참고).

**오류·예외**

- **Supabase 초대 링크의 수명(기본 24시간)과 `expires_at`(7일)은 다른 개념이다.** 전자는 링크, 후자는 "이 주소로 가입하면 관리자가 된다"는 근거의 수명이다. 링크만 만료된 경우 재발송으로 이어갈 수 있다.
- 대소문자만 다른 중복 초대는 유니크 인덱스 `admin_invites_email_key on (lower(email))` 가 막는다. 조회도 항상 `ilike` 로 한다.
- 관리자를 삭제하면 같은 이메일의 초대가 `revoked` 로 함께 내려간다 — 남겨 두면 그 주소로 재가입할 때 다시 관리자가 된다.
- 이메일 발송 자체의 성공은 Supabase 응답 기준이다. 실제 수신 여부(스팸함 등)는 이 화면에서 알 수 없다.
