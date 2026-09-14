# 관리자 — 목록 (`/admins`)

**목적** 관리자 계정을 초대·삭제(= 콘솔 접근 차단)하고, 역할(모듈별 권한)을 만들어 배정한다. 한 페이지에 표 세 개(관리자 · 수락 대기 초대 · 권한)가 세로로 놓인다.

**데이터 출처** `requireSuperAdmin()` 과 세 조회를 `Promise.all` 로 함께 부른다(`admin/lib/data/admins.ts`, 모두 세션 클라이언트).
- `getAdmins()` — `profiles` 에서 `role='admin'` 인 행을 `created_at` 오름차순으로, `admin_roles(key, name)` 임베드. 실패 시 `console.error('[admins] 목록 조회 실패')` + 빈 배열.
- `getPendingInvites()` — `admin_invites` 에서 `status='pending'` 인 행을 `created_at` 내림차순으로. `isExpired = expires_at <= now`.
- `getAdminRoles()` — `admin_roles` 를 `is_system desc, created_at asc` 로 읽고, 사용 인원은 **별도 질의**로 센다(`countRoleMembers()`: `role='admin'` 且 `admin_role_id is not null`). PostgREST 임베드 집계는 역방향 관계에 필터를 걸 수 없어 `role='user'` 인 잔여 참조까지 세기 때문이다.

페이지 헤더: 제목 `관리자`, 설명 "관리자 계정을 초대·삭제하고 권한(역할)을 관리합니다. 삭제는 계정을 지우지 않고 콘솔 로그인을 막습니다.", action = `관리자 초대` 버튼(→ [02-invite-form.md](02-invite-form.md)).

## 1.1 관리자 목록 (`AdminsTable`)

카드 머리 `관리자 {N}명` + "역할을 바꾸면 다음 요청부터 사이드바와 화면 권한이 함께 바뀝니다."

| 열 | 종류 | 값의 출처 | 동작 / 상호작용 |
|---|---|---|---|
| 닉네임 | 텍스트(굵게) + 뱃지 | `profiles.nickname` | 본인 행에는 `나` 뱃지(accent) |
| 이메일 | 텍스트 | `profiles.email` | `null` 이면 `-` |
| 권한 | 뱃지(w-36) | `admin_roles.name` | 역할 없으면 `역할 없음`(warn), 슈퍼어드민이면 accent, 그 외 neutral |
| 등록일 | 일시(w-40) | `profiles.created_at`(`formatDateTime`) | 계정 생성 시각(초대 메일 발송 시점에 `auth.users` 행이 만들어진다) |
| 역할 변경 | 셀렉트 + 저장 버튼(`AdminRoleSelect`, w-250) | 역할 전체(`roleOptions`) | 아래 §1.1.1 |
| (조치) | 삭제 버튼(`DeleteAdminButton`, w-24) | — | 아래 §1.1.2 |

빈 목록 문구 `관리자가 없습니다.`
**마지막 로그인 시각 열은 없다** — `auth.users` 에만 있어 서비스 롤로 전 계정을 훑어야 하는데, 목록 한 줄을 채우자고 RLS 밖 조회 경로를 열지 않는다(필요하면 `/audit` 이 더 정확한 이력을 준다).

### 1.1.1 역할 변경 (`AdminRoleSelect` → `changeAdminRoleAction`)

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값 | 동작 / 상호작용 |
|---|---|---|---|---|
| adminId | hidden | `z.uuid('대상을 찾을 수 없습니다.')` | 행의 id | — |
| 역할 | 셀렉트(`aria-label="역할"`) | `z.uuid('역할을 선택해 주세요.')` | 현재 `admin_role_id`(없으면 placeholder `역할 없음`) | **고르자마자 저장하지 않는다** — 셀렉트는 키보드 화살표로 값이 스쳐 지나가기 때문. 값이 바뀌었을 때만 저장 버튼이 살아난다 |
| 저장 | 제출 버튼(secondary, sm) | 값이 비었거나 현재와 같으면 비활성 | — | `changeAdminRoleAction`. 진행 중 `저장 중…`. 성공 토스트 `{닉네임} 님의 역할을 {역할명} 로 바꿨습니다.` / 실패 시 에러 토스트 + **셀렉트를 원래 값으로 되돌린다** |
| (본인 행) | 문구 | — | — | 셀렉트 대신 `자기 역할은 바꿀 수 없습니다.` 텍스트만 |

거절 문구: `자기 자신의 권한은 바꿀 수 없습니다.` / `관리자를 찾을 수 없습니다.`(대상이 `role='admin'` 이 아님) / `이미 같은 역할입니다.` / `역할을 찾을 수 없습니다.` / `마지막 슈퍼어드민입니다. 다른 슈퍼어드민을 먼저 지정해 주세요.`(슈퍼어드민을 다른 역할로 내리는데 `countSuperAdmins() <= 1`) / DB 실패 `역할을 바꾸지 못했습니다. 권한은 그대로입니다. 다시 시도해 주세요.`
DB 변경 `profiles.admin_role_id`. 감사 `admin.role.change`(before `{role: 이전 key}` / after `{role: 새 key}`).

### 1.1.2 관리자 삭제 (`DeleteAdminButton` → `deleteAdminAction`)

| 필드/컨트롤 | 종류 | 필수·제한 | 동작 / 상호작용 |
|---|---|---|---|
| 삭제 | 버튼(danger, sm) | 본인 행에서는 버튼 대신 `본인` 텍스트(`title="자기 자신은 삭제할 수 없습니다."`) | 확인 다이얼로그를 연다 |
| 다이얼로그 제목 | 고정 | — | `관리자 삭제` |
| 다이얼로그 설명 | 고정 | — | `{닉네임} 관리자를 삭제합니다. 관리자 콘솔에 로그인할 수 없게 되며 작성 이력은 남습니다.` — "삭제"라는 단어만 보면 글까지 사라진다고 오해하므로 실제로 일어나는 일을 그대로 적는다 |
| adminId | hidden | `z.uuid()` | — |
| 취소 / 삭제 | 버튼 | 진행 중 `삭제 중…` | 실패 시 다이얼로그 안 배너에 사유 |

3단계 처리와 거절 규칙은 → [README](README.md) §2. 성공 토스트 `{닉네임} 관리자를 삭제했습니다.` 실패 문구 `관리자를 삭제하지 못했습니다. 권한은 그대로입니다. 다시 시도해 주세요.` 감사 `admin.delete`(before `{role:'admin', adminRole: key}` / after `{role:'user', banned:true}`).

## 1.2 수락 대기 초대 (`InvitesTable`)

카드 머리 `수락 대기 초대 {N}건` + "받은 사람이 링크에서 비밀번호를 정하면 관리자가 됩니다. 링크가 만료되면 재발송하세요."

| 열 | 종류 | 값의 출처 | 동작 / 상호작용 |
|---|---|---|---|
| 이메일 | 텍스트(굵게) + 뱃지 | `admin_invites.email` | `expires_at <= now` 면 `만료`(warn) 뱃지 |
| 권한 | 뱃지(w-36) | `admin_roles.name`(초대에 실린 역할) | 없으면 `-` |
| 발송일 | 일시(w-40) | `created_at` | — |
| 만료 | 일시(w-40) | `expires_at` | `null` 이면 `없음`(부트스트랩 초대) |
| 조치 | 버튼 2개(`InviteActions`, w-40) | — | 아래 |

**만료된 초대도 지우지 않고 계속 보여 준다** — 재발송 한 번이면 되살아나는데 목록에서 사라지면 "초대를 보냈던가?"부터 다시 확인해야 한다. 빈 목록 문구 `대기 중인 초대가 없습니다.`

| 조치 | 액션 | 검증 | DB 변경 | 감사 | 결과 |
|---|---|---|---|---|---|
| 재발송 | `resendInviteAction` | `inviteId` 비어 있지 않을 것 → "초대를 찾을 수 없습니다." / `status === 'pending'` 아니면 "이미 수락되었거나 취소된 초대입니다." | `expires_at` 을 지금부터 7일 뒤로 연장 + 서비스 롤 `auth.admin.inviteUserByEmail()` 재호출(새 링크) | `admin.invite.resend`(after `{email}`) | 토스트 `{이메일} 으로 초대 메일을 다시 보냈습니다.` / 실패 "초대 메일을 다시 보내지 못했습니다. 잠시 후 다시 시도해 주세요." |
| 취소 | `revokeInviteAction` | 위와 동일 | `status = 'revoked'`(행은 남긴다 — DELETE 정책 자체가 없다) | `admin.invite.revoke`(before `{email, status:'pending'}` / after `{status:'revoked'}`) | 토스트 `{이메일} 초대를 취소했습니다.` / 실패 "초대를 취소하지 못했습니다. 다시 시도해 주세요." |

**확인 다이얼로그를 세우지 않는다** — 둘 다 되돌리기 쉬운 조작이고(취소한 초대는 다시 보내면 된다), 모든 조작을 다이얼로그로 감싸면 습관적으로 확인을 눌러 결국 아무것도 막지 못한다. 두 버튼은 서로의 진행 중에 함께 비활성된다.

## 1.3 권한(역할) 목록 (`RolesTable`)

카드 머리 `권한 {N}개` + "모듈마다 없음 · 읽기 · 쓰기를 정합니다. 슈퍼어드민은 시스템 역할이라 바꿀 수 없습니다." + action `역할 추가`(→ [03-permissions-editor.md](03-permissions-editor.md)).

| 열 | 종류 | 값의 출처 | 동작 / 상호작용 |
|---|---|---|---|
| 이름 | 텍스트 2줄 + 뱃지 | `name` / 아래 `key`(모노스페이스) | `is_system` 이면 `시스템` 뱃지(accent) |
| 설명 | 텍스트 | `description` | `null` 이면 `-` |
| 권한 | 텍스트(w-32) | `summarizePermissions(permissions)` | 전 모듈 write 면 `전체 쓰기`, 아니면 `쓰기 N · 읽기 M`, 하나도 없으면 `권한 없음`. 정확한 값은 수정 다이얼로그의 매트릭스에서 본다(14개를 표에 펼치면 읽히지 않는다) |
| 사용 | 숫자(우측, w-20) | `memberCount` | `{N}명` |
| 조치 | 버튼(w-44) | — | 시스템 역할이 아니면 `수정`(다이얼로그), 삭제는 아래 |

빈 목록 문구 `역할이 없습니다.`

**삭제 버튼(`DeleteRoleButton`)의 3가지 표시**

| 조건 | 화면 | 이유 |
|---|---|---|
| `is_system` | `시스템 역할` 텍스트(버튼 없음) | 지우면 콘솔에 아무도 못 들어온다 |
| `memberCount > 0` | `사용 중 {N}명` 텍스트(버튼 없음) | 눌러 보고 나서야 사유를 알려 주면 무엇을 먼저 해야 하는지 알 수 없다 |
| 그 외 | `삭제` 버튼 → 다이얼로그(`역할 삭제` / `{이름} 역할을 삭제합니다. 이 역할을 쓰는 관리자는 없습니다.`) | — |

`deleteAdminRoleAction` 은 같은 두 조건(`시스템 역할은 삭제할 수 없습니다.` / `이 역할을 쓰는 관리자가 {N}명 있습니다. 먼저 다른 역할로 바꿔 주세요.`)을 서버에서 다시 검사한다. 성공 토스트 `{이름} 역할을 삭제했습니다.` 감사 `admin.role.delete`(before `{key, name}`).

**상태·뱃지 의미**

| 뱃지 | 색 | 뜻 |
|---|---|---|
| 나 | accent | 로그인한 본인 행(역할 변경·삭제 불가) |
| 역할 없음 | warn | `admin_role_id` 가 비어 있다 — 콘솔에는 들어오지만 **아무 모듈도 보이지 않는다**(닫힘 실패) |
| 슈퍼어드민 역할명 | accent | `admin_roles.key === 'super_admin'` |
| 만료 | warn | 초대 허용 목록의 수명(7일)이 지났다. `pending` 이어도 승격 근거가 되지 않는다 |
| 시스템 | accent | `is_system = true` — 수정·삭제 불가 |

**클라이언트와의 상호작용**

- 이 화면은 관리자 콘솔 전용이며 사용자 사이트와 연결된 화면이 없다. 회원을 관리자로 승격하는 경로 자체가 없다.
- 초대 메일의 링크는 **관리자 앱**(`NEXT_PUBLIC_ADMIN_URL`)의 `/auth/callback?next=/invite/accept` 를 가리킨다 → `14-auth/04-invite-accept.md`.
- 역할을 바꾸면 **다음 요청부터** 사이드바(`visibleNavItems`)와 화면 권한이 함께 바뀐다(권한은 `requireAdmin()` 이 요청마다 `profiles` + `admin_roles` 를 한 번에 읽는다).

**오류·예외**

- 세 조회 중 하나가 실패해도 화면은 그려진다(그 표만 비어 보인다). 원인은 서버 로그.
- `관리자 초대` 버튼은 역할이 하나도 없으면 비활성된다(`roleOptions.length === 0`).
- 역할을 지우면 FK `on delete set null` 로 그 역할을 쓰던 관리자는 `역할 없음` 이 된다 — 화면이 사용 인원 0명일 때만 삭제를 허용하는 이유다.
- DB 도 같은 규칙을 한 번 더 강제한다(`admin_roles_insert_super`·`_update_super`·`_delete_super` 정책, `is_super_admin()`, 가드 트리거) — 앱에서만 막으면 REST 직접 호출로 우회된다.
