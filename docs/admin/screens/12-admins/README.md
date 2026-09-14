# 관리자 — 메뉴 개요

> 관리자 콘솔(`admin/`)의 관리자 메뉴. 화면 하나당 파일 하나이며, 각 파일은 `_TEMPLATE.md` 형식을 따른다.
> 인증·권한 체계의 배경(초대 흐름 · RLS 이중 방어 · 첫 슈퍼어드민)은 `admin/README.md` §4 참고. 여기서는 화면·필드·액션 사실만 적는다.

## 0. 한눈에

| 항목 | 값 |
|---|---|
| 경로 | `/admins` (하위 라우트 없음. 목록 3개 + 다이얼로그 2종이 한 페이지에 있다) |
| 권한 모듈 | 화면·모든 액션이 **슈퍼어드민 전용**(`requireSuperAdmin()`, `admin/lib/auth/require-admin.ts`). `admins` 모듈의 read/write 등급은 **사이드바 노출 여부만** 좌우한다 — `admins: read` 만 있는 관리자는 메뉴는 보이지만 눌러 들어가면 `/?error=forbidden` 으로 되돌아간다 |
| 주요 테이블 | `profiles`(`role`·`admin_role_id`·`email`·`nickname`·`created_at`), `admin_roles`(`key` unique·`name`·`description`·`permissions jsonb`·`is_system`), `admin_invites`(`email`·`role_id`·`invited_by`·`status`·`expires_at`·`accepted_at`) |
| 클라이언트 영향 | **없음.** 관리자 전용 테이블이라 어떤 액션도 `revalidateClient()` 를 부르지 않는다(남의 캐시를 이유 없이 비우지 않는다). 화면 갱신은 `revalidatePath('/admins')` 뿐 |
| 관련 파일 | 페이지 `admin/app/(admin)/admins/page.tsx` · 컴포넌트 `admin/components/admins/*` · 액션 `admin/lib/actions/{admin-actions,admin-invite-actions,admin-role-actions,admin-shared}.ts` · 데이터 `admin/lib/data/admins.ts` · 검증 `admin/lib/validation/admins.ts` · 권한 모델 `admin/lib/auth/permissions.ts` · 서비스 롤 `admin/lib/supabase/admin.ts` · 마이그레이션 `supabase/migrations/20260908001700_admin_foundation.sql`, `20260909000200_admin_roles.sql` |

## 1. 화면 목록

| # | 문서 | 경로 | 한 줄 |
|---|---|---|---|
| 01 | [01-list.md](01-list.md) | `/admins` | 관리자 목록 · 수락 대기 초대 · 권한(역할) 목록 세 표와 행 조치 |
| 02 | [02-invite-form.md](02-invite-form.md) | 관리자 초대 다이얼로그 | 이메일 + 역할 → 초대 행 + 초대 메일 |
| 03 | [03-permissions-editor.md](03-permissions-editor.md) | 역할 추가/수정 다이얼로그 | 키·이름·설명 + 모듈 14행 × 등급 3열 라디오 매트릭스 |

## 2. 메뉴 전체 규칙

- **관리자를 만드는 유일한 경로는 이메일 초대다**(2026-09-09 제품 결정). 회원을 승격하는 화면은 없앴고, 이미 계정이 있는 이메일로 초대하면 조용히 승격하지 않고 거절한다.
- **권한 모델** 모듈 × (`none`·`read`·`write`). `ADMIN_MODULES` 14개가 단일 출처 — `dashboard`·`news`·`community`·`reports`·`members`·`coupons`·`inquiries`·`faqs`·`gacha`·`rankings`·`settings`·`legal`·`admins`·`audit`. `write` 는 `read` 를 포함한다(`LEVEL_RANK` 서열 비교). **값이 없는 모듈은 `none`** 으로 읽히므로 새 모듈이 기존 역할에 자동으로 열리지 않는다(닫힘 실패).
- **RLS 는 거친 문 하나**(`is_admin()`)다. 모듈별 read/write 강제는 앱 계층 `requirePermission()` 이 한다 — 역할을 정책에 녹이면 정책 수가 모듈×역할로 폭발한다. 대신 권한을 바꿀 수 있는 경로(`profiles.role`·`admin_role_id`·`admin_roles`)는 DB 에서 `is_super_admin()` 정책과 가드 트리거로 잠근다(두 겹).
- **자기 보호 규칙**(모든 액션 공통)
  - 자기 자신의 역할 변경·삭제 불가 — 실수로 스스로를 잠그면 복구에 서비스 롤 스크립트가 필요하다.
  - **마지막 슈퍼어드민**은 강등·삭제 불가(`countSuperAdmins() <= 1`) — 0 이 되는 순간 권한 체계를 되돌릴 사람이 사라진다.
  - 시스템 역할(`super_admin`, `is_system = true`)은 수정·삭제 불가. 역할 `key` 는 생성 후 불변이고 `super_admin` 은 예약어다.
  - 사용 인원이 있는 역할은 삭제 불가(FK 가 `on delete set null` 이라 지워도 오류는 없지만, 그 인원이 아무 화면도 못 보게 되는 조용한 사고가 난다).
- **삭제 = 3단계**(계정 행을 지우지 않는다. 작성한 뉴스·답변의 작성자 참조를 보존해야 한다):
  ① `profiles.role = 'user'` + `admin_role_id = null` → ② 그 이메일의 초대를 `status='revoked'` → ③ 서비스 롤로 `auth.admin.updateUserById(id, { ban_duration: '876600h' })`(100년, Supabase 에 영구 플래그가 없다). 셋 중 하나라도 빠지면 문이 완전히 잠기지 않는다. ③ 이 실패해도 되돌리지 않고 로그만 남긴다(권한은 이미 회수됐다).
- **감사 로그** `admin.invite` / `admin.invite.resend` / `admin.invite.revoke`(대상 `admin_invites`) · `admin.role.change` / `admin.delete`(대상 `profiles`) · `admin.role.create` / `admin.role.update` / `admin.role.delete`(대상 `admin_roles`). 감사 화면 대상 링크는 `admin_invites` → `/admins`, `profiles` → `/members/[id]` 이며 `admin_roles` 는 매핑이 없어 ID 만 표시된다.
- **`dynamic = 'force-dynamic'`**. 모든 조회는 세션 클라이언트로 한다(서비스 롤로 읽으면 권한이 사라져도 목록이 계속 보이는 검증 구멍이 생긴다). 서비스 롤은 초대 메일 발송·계정 차단 두 곳에서만 쓴다.
