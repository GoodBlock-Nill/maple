# 관리자 — 역할 · 권한 편집 다이얼로그 (`RoleFormDialog` + `PermissionMatrixField`)

**목적** 역할(모듈별 권한 묶음)을 만들거나 고친다. 다이얼로그 설명은 "모듈마다 없음 · 읽기 · 쓰기 중 하나를 고릅니다. 쓰기는 읽기를 포함합니다." 다. `role` prop 이 `null` 이면 추가, 아니면 수정이다.

**데이터 출처** 목록이 읽어 둔 `AdminRoleItem` 을 프리필한다(`permissions` 는 `parsePermissions()` 로 이미 좁혀진 값). 폼은 `key={role?.id ?? 'new'}` 로 다시 마운트해 다른 역할을 열었을 때 비제어 입력이 이전 값을 남기지 않게 한다.

## 1.1 기본 필드

| 필드/컨트롤 | 종류 | 필수·제한 | 기본값 | 저장 컬럼 |
|---|---|---|---|---|
| 역할 추가 / 수정 | 버튼 | 시스템 역할이면 비활성 | — | — |
| roleId | hidden | 수정일 때만 렌더 | `role.id` | — |
| 키 | 텍스트 | 필수 2~31자 + 패턴 | 빈 값 | `key` |
| 이름 | 텍스트 | 필수 1~30자 | `role.name` | `name` |
| 설명 | 텍스트 | 선택 ≤120자 | `role.description` | `description` |
| 폼 오류 배너 | `FormBanner` | — | 없음 | — |
| 취소 / 저장 | 버튼 | 진행 중 비활성 | — | — |

**동작 상세**

- **역할 추가 / 수정** 추가는 primary, 수정은 secondary·sm 이며 액션 분기는 컴포넌트가 `isEdit` 으로 정한다.
- **키** 상한 상수는 `ROLE_KEY_MAX_LENGTH`(31)이고 패턴은 `^[a-z][a-z0-9_]{1,30}$` 다. 마이그레이션 `admin_roles_key_format` 체크와 같은 식이다.
- **키** `super_admin` 은 예약어라 쓸 수 없다.
- **키** placeholder 는 `content_editor`, 힌트는 "영문 소문자로 시작하는 slug. 만든 뒤에는 바꿀 수 없습니다." 다.
- **키** 수정 화면에서는 입력칸 대신 `키 {key} · 만든 뒤에는 바꿀 수 없습니다.` 안내만 나온다. 바꿀 수 있게 두면 이미 남은 감사 로그가 다른 역할을 가리키고 DB 트리거도 되돌린다.
- **이름** 상한 상수는 `ROLE_NAME_MAX_LENGTH`(30)다. 목록 표와 관리자 행의 권한 뱃지에 그대로 나온다.
- **설명** 상한 상수는 `ROLE_DESCRIPTION_MAX_LENGTH`(120)이고 빈 값은 `null` 로 저장된다.
- **취소 / 저장** 진행 중에는 `저장 중…` 이고, 성공 시 토스트와 함께 닫힌다.

## 1.2 권한 매트릭스 (`PermissionMatrixField`)

`<fieldset>` 안에 머리글 행(`모듈`·`없음`·`읽기`·`쓰기`)과 모듈 14행이 들어간다. 스크린리더용 legend 는 `모듈별 권한` 이고 목록 영역은 `max-h-[280px]` 스크롤이다.

| 항목 | 내용 |
|---|---|
| 행(모듈) | `ADMIN_MODULES` 순서 그대로 14개 |
| 열(등급) | `PERMISSION_LEVELS` 세 가지 |
| 컨트롤 | 라디오 3개 |
| 필드 이름 | `permission.<module>` |
| 기본 선택 | 수정은 기존 값, 추가는 `none` |

**동작 상세**

- **행(모듈)** 순서는 대시보드 → 뉴스 → 커뮤니티 → 신고 → 회원 → 쿠폰 → 홈페이지 문의 다음이다.
- **행(모듈)** 이어서 FAQ → 가이드 → 랭킹 → 사이트 설정 → Legal → 관리자 → 감사 로그다.
- **열(등급)** 값은 `none`(없음)·`read`(읽기)·`write`(쓰기)다.
- **컨트롤** 체크박스 두 개가 아닌 이유는 "읽기는 껐는데 쓰기는 켠" 조합이 만들어지고 그 의미를 아무도 설명할 수 없기 때문이다. 등급은 서열이므로 하나만 고른다.
- **필드 이름** 접두사 상수는 `PERMISSION_FIELD_PREFIX` 이고 서버는 `readPermissionFields()` 로 이 접두사가 붙은 항목만 모은다.
- **기본 선택** 수정 시 값은 `role.permissions[module] ?? 'none'` 이다.
- **접근성** 라디오마다 `aria-label="{모듈명} {등급명}"` 이 붙는다.
- **상태** 비제어다. 폼이 그대로 제출하고 서버가 다시 파싱한다 — 상태를 들면 라디오 14×3 이 매 클릭마다 리렌더된다.

**서버 파싱 규칙**(`permissionMatrixSchema` → `toModulePermissions`)

- 값은 `z.enum(['none','read','write'])` 로 검사한다.
- 빠진 모듈은 `none` 으로 채우고 모르는 모듈 키는 버린다.
- 폼은 14개를 모두 보내므로 실제로는 빠질 일이 없지만, 직접 POST 로 일부만 실어 보내는 요청에서 열려 있는 쪽으로 기우는 기본값이 생기면 안 된다.
- 저장되는 값은 항상 14개 키를 모두 가진 객체다(DB 체크 `admin_roles_permissions_object`: jsonb object).

**등급의 실제 의미**

| 등급 | 뜻 |
|---|---|
| 없음(`none`) | 사이드바에서 메뉴가 사라진다 |
| 읽기(`read`) | 목록·상세를 볼 수 있다 |
| 쓰기(`write`) | 읽기를 포함하고 쓰기 조작이 열린다 |

**등급 상세**

- **없음** 판정은 `visibleNavItems` 가 한다. 흐리게 남겨 두면 눌러 보고 대시보드로 튕기는 경험을 반복하므로 아예 지운다.
- **없음** URL 직접 접근은 `requirePermission()` 이 `/?error=forbidden` 으로 되돌린다.
- **읽기** 쓰기 버튼·폼은 화면에서 빠진다.
- **쓰기** 포함 판정은 `LEVEL_RANK` 비교다. 저장·삭제·상태 변경이 열린다.
- **쓰기** `level:'write'` 로 표시된 하위 메뉴가 사이드바에 나타난다 — 뉴스의 `새 글 작성`·`카테고리 템플릿`, 가이드의 `새 아이템` 이다.
- **`admins` 모듈 예외** 이 모듈에 `write` 를 줘도 `/admins` 화면은 열리지 않는다. 화면과 모든 액션이 `requireSuperAdmin()` 이라 이 등급은 사이드바 노출 여부만 좌우한다.
- **`admins` 모듈 예외** 권한 체계 자체를 바꾸는 조작은 역할표로 위임할 수 없다 — 위임 가능하면 임의의 역할이 스스로를 슈퍼어드민으로 올릴 수 있다.

## 1.3 서버 동작

| 액션 | 대상 | DB 변경 | 감사 |
|---|---|---|---|
| `createAdminRoleAction` | 새 역할 | `admin_roles` insert | `admin.role.create` |
| `updateAdminRoleAction` | 기존 역할 | `admin_roles` update | `admin.role.update` |

**동작 상세**

- **공통** `requireSuperAdmin()` 으로 시작하고 성공 후 `revalidatePath('/admins')` 를 부른다.
- **생성** 스키마는 `createRoleSchema`(key·name·description) + `permissionMatrixSchema` 다.
- **생성** insert 컬럼은 `key`·`name`·`description`·`permissions` 이고 감사 after 는 `{ key, permissions }` 다.
- **생성** 성공 토스트는 `{이름} 역할을 만들었습니다.` 다.
- **수정** 스키마는 `updateRoleSchema`(roleId·name·description) + `permissionMatrixSchema` 다.
- **수정** 대상 존재와 `is_system` 여부를 먼저 확인한다.
- **수정** update 컬럼은 `name`·`description`·`permissions` 이고 `key` 는 건드리지 않는다.
- **수정** 감사 before 는 `{permissions: 이전}`, after 는 `{permissions: 새 값}` 이고 성공 토스트는 `{이름} 역할을 저장했습니다.` 다.

**시드 역할 두 개**(`supabase/migrations/20260909000200_admin_roles.sql`)

| key | 이름 | 권한 요약 |
|---|---|---|
| `super_admin` | 슈퍼어드민 | 전 모듈 `write`, `is_system = true` |
| `editor` | 콘텐츠 편집자 | 콘텐츠 write + 운영 지표 read |

**시드 상세**

- **`super_admin`** 화면에서 수정·삭제가 불가하고 마이그레이션을 재실행하면 값이 다시 덮어써진다.
- **`editor`** write 대상은 `news`·`community`·`faqs`·`gacha`·`legal` 이다.
- **`editor`** read 대상은 `dashboard`·`reports`·`members`·`inquiries` 다.
- **`editor`** none 대상은 `rankings`·`settings`·`admins`·`audit` 이고 삭제 가능한 예시 역할이다.
- **공통 누락** 시드에는 `coupons` 키가 없다. `permissionLevel()` 이 값 없는 모듈을 `none` 으로 읽으므로 두 시드 역할 모두 쿠폰 메뉴가 닫혀 있다(슈퍼어드민 포함).

**클라이언트와의 상호작용** 없다(사용자 사이트와 무관하며 `revalidateClient()` 를 부르지 않는다).

**오류·예외**

- 키 길이: "키는 2자 이상이어야 합니다." / "키는 31자를 넘을 수 없습니다."
- 키 패턴: "키는 영문 소문자로 시작하고 영문 소문자·숫자·밑줄만 쓸 수 있습니다."
- 키 중복 또는 예약어(23505 포함): "이미 사용 중인 키입니다."
- 이름 누락·길이: "이름을 입력해 주세요." / "이름은 30자를 넘을 수 없습니다."
- 설명 길이: "설명은 120자를 넘을 수 없습니다."
- 권한 값 이상: "권한 값이 올바르지 않습니다." (필드) / "권한 값이 올바르지 않습니다. 화면을 새로고침한 뒤 다시 시도해 주세요." (폼 배너)
- 대상 없음: "역할을 찾을 수 없습니다."
- 시스템 역할 수정: "시스템 역할은 수정할 수 없습니다."
- 생성 실패: "역할을 만들지 못했습니다. 다시 시도해 주세요."
- 수정 실패: "역할을 저장하지 못했습니다. 다시 시도해 주세요."
- 역할을 바꿔도 이미 로그인해 있는 관리자의 세션은 끊기지 않는다. 권한은 다음 요청부터 적용된다(`requireAdmin()` 이 매 요청 `profiles` 와 `admin_roles` 를 다시 읽는다).
- 전 모듈을 `none` 으로 저장할 수 있다(목록 표에 `권한 없음` 으로 표시). 그 역할을 받은 관리자는 로그인은 되지만 사이드바가 비고 모든 화면이 대시보드로 튕긴다.
- DB 도 같은 규칙을 강제한다. `admin_roles_insert_super`·`_update_super`·`_delete_super` 정책(`is_super_admin()`)과 가드 트리거가 시스템 역할 수정·삭제를 막는다.
- 매트릭스는 스크롤 영역이라 아래쪽 모듈(관리자·감사 로그)을 못 보고 저장하기 쉽다. 저장은 화면에 보이지 않는 행까지 전부 반영한다.
