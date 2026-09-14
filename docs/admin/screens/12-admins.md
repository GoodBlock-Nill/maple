# 관리자 — 화면·기능 설명

> 관리자 콘솔(`admin/`)의 관리자 메뉴. 경로 · 권한 · 화면 구성 · 동작(서버 액션) · 클라이언트(사용자 사이트)와의 상호작용을 개발 참고용으로 정리한다.
> 작성 규칙: 코드에서 확인한 사실만 쓴다. 파일 경로는 저장소 루트 기준. 워딩은 "카테고리"(말머리 금지).
> 인증·권한 체계(초대 흐름 · RLS 이중 방어 · 첫 슈퍼어드민)의 전체 배경은 `admin/README.md` §4를 참고한다. 이 문서는 화면·액션 사실만 다룬다.

## 0. 한눈에

| 항목 | 값 |
|---|---|
| 경로 | `/admins` |
| 권한 모듈 | 화면 자체는 **슈퍼어드민 전용**(`requireSuperAdmin()`) — `admins` 모듈 read/write 등급과 별개다(`admin/lib/auth/require-admin.ts`) |
| 주요 테이블 | `profiles`(`role`·`admin_role_id`), `admin_roles`, `admin_invites` |
| 클라이언트 영향 | 없음(관리자 전용 테이블이라 `revalidateClient()`를 부르지 않는다) |
| 관련 파일 | `admin/app/(admin)/admins/page.tsx`, `admin/components/admins/*`, `admin/lib/{actions,data,validation}/admin*.ts` |

## 1. 관리자 · 권한 (`/admins`)

**목적** 관리자 계정을 초대·삭제(=콘솔 접근 차단)하고, 역할(모듈별 권한)을 만들고 배정한다. **관리자를 만드는 유일한 경로는 이메일 초대다**(2026-09-09 제품 결정) — 회원을 승격하는 화면은 없다.

**화면 구성**
- 관리자 목록(`AdminsTable`): 닉네임(본인 "나" 뱃지), 이메일, 권한(역할명 또는 "역할 없음"), 등록일, 역할 변경 셀렉트(`AdminRoleSelect`, 자기 자신은 비활성), [삭제] 버튼(자기 자신은 비활성).
- 수락 대기 초대(`InvitesTable`): 이메일(만료 뱃지), 권한, 발송일, 만료일, [재발송 / 취소](`InviteActions`).
- 권한(역할) 목록(`RolesTable`): 이름(+시스템 뱃지), 설명, 권한 요약("쓰기 N · 읽기 M", `summarizePermissions`), 사용 인원, [수정(시스템 역할 제외) / 삭제].
- 헤더 액션: "관리자 초대" 다이얼로그(이메일 + 역할 셀렉트). 권한 카드 액션: "역할 추가" 다이얼로그(key · 이름 · 설명 + 14개 모듈 권한 매트릭스 라디오, `PermissionMatrixField`).

**동작(서버 액션)**
| 동작 | 액션 함수 | 검증 | DB 변경 | 감사 로그 | 클라이언트 영향 |
|---|---|---|---|---|---|
| 초대 | `inviteAdminAction` (`admin/lib/actions/admin-invite-actions.ts`) | zod `inviteAdminSchema` + 기존 계정 존재 여부 확인(승격 거절) | `admin_invites` insert(`pending`, 7일) **먼저**, 이어서 `auth.admin.inviteUserByEmail()` | `admin.invite` | 없음 |
| 재발송 | `resendInviteAction` | 초대가 `pending`인지 | `admin_invites.expires_at` 연장 + 메일 재발송 | `admin.invite.resend` | 없음 |
| 초대 취소 | `revokeInviteAction` | 초대가 `pending`인지 | `admin_invites.status='revoked'` | `admin.invite.revoke` | 없음 |
| 역할 변경 | `changeAdminRoleAction` (`admin/lib/actions/admin-actions.ts`) | zod `changeAdminRoleSchema`, 자기 자신 불가, 마지막 슈퍼어드민 강등 불가 | `profiles.admin_role_id` | `admin.role.change` | 없음 |
| 삭제(=비활성화) | `deleteAdminAction` | zod `deleteAdminSchema`, 자기 자신 불가, 마지막 슈퍼어드민 불가 | `profiles.{role='user',admin_role_id=null}` + 해당 이메일 초대 `revoked` + `auth.admin.updateUserById(ban_duration:'876600h')` | `admin.delete` | 없음 |
| 역할 생성 | `createAdminRoleAction` (`admin/lib/actions/admin-role-actions.ts`) | zod `createRoleSchema` + `permissionMatrixSchema` | `admin_roles` insert | `admin.role.create` | 없음 |
| 역할 수정 | `updateAdminRoleAction` | zod `updateRoleSchema` + `permissionMatrixSchema`, 시스템 역할 불가 | `admin_roles.{name,description,permissions}`(`key`는 불변) | `admin.role.update` | 없음 |
| 역할 삭제 | `deleteAdminRoleAction` | 시스템 역할 불가, 사용 인원 0명 | `admin_roles` delete | `admin.role.delete` | 없음 |

**클라이언트와의 상호작용**
- 이 화면은 관리자 콘솔 전용이며 사용자 사이트와 연결된 화면이 없다. 회원을 관리자로 승격하는 경로 자체를 없앴다(`admin/README.md` §3).
- 초대 메일의 링크는 관리자 앱 자신(`NEXT_PUBLIC_ADMIN_URL`)을 가리킨다 → `/auth/callback?next=/invite/accept` → `14-auth.md` §4.

**주의**
- 삭제는 계정 행을 지우지 않는다(작성한 뉴스·답변의 작성자 참조 보존). "삭제" = `profiles.role`을 내리고 + 초대를 `revoked`로 되돌리고 + Auth 계정을 100년(`876600h`) 정지시키는 3단계다. 셋 중 하나라도 빠지면 문이 완전히 잠기지 않는다(세부 근거는 `admin/README.md` §4.4).
- 자기 자신의 역할 변경·삭제는 항상 막힌다. **마지막 슈퍼어드민**도 강등·삭제할 수 없다(`countSuperAdmins()` <= 1이면 거절) — 0이 되는 순간 권한 체계를 되돌릴 사람이 사라진다.
- 이미 계정이 있는 이메일은 조용히 승격하지 않고 거절한다(`EXISTING_USER_MESSAGE`) — "초대를 수락했다"는 사실 없이 권한을 주지 않는다.
- 역할 `key`는 만든 뒤 바꿀 수 없고, `super_admin`은 예약어라 새 역할이 쓸 수 없다. 역할 삭제는 사용 인원이 0명일 때만 가능하다(FK가 `set null`이라 지워도 오류는 없지만, 지우면 그 인원이 아무 화면도 못 보게 되는 조용한 사고이기 때문).
- DB도 같은 규칙을 한 번 더 강제한다(`admin_roles_*_super` 정책, `guard_admin_roles()` 트리거) — 앱에서만 막으면 REST 직접 호출로 우회될 수 있다.
