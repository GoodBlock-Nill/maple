# 관리자 — 역할 · 권한 편집 다이얼로그 (`RoleFormDialog` + `PermissionMatrixField`)

**목적** 역할(모듈별 권한 묶음)을 만들거나 고친다. 다이얼로그 설명: "모듈마다 없음 · 읽기 · 쓰기 중 하나를 고릅니다. 쓰기는 읽기를 포함합니다." `role` prop 이 `null` 이면 추가, 아니면 수정이다.

**데이터 출처** 목록이 읽어 둔 `AdminRoleItem`(`permissions` 는 `parsePermissions()` 로 이미 좁혀진 값)을 프리필한다. 폼은 `key={role?.id ?? 'new'}` 로 다시 마운트해 다른 역할을 열었을 때 비제어 입력이 이전 값을 남기지 않게 한다.

## 1.1 기본 필드

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값 | 동작 / 상호작용 |
|---|---|---|---|---|
| 역할 추가 / 수정 | 버튼 | 시스템 역할(`is_system`)이면 **비활성**. 추가는 primary, 수정은 secondary·sm | — | 다이얼로그를 연다 |
| roleId | hidden | 수정일 때만 렌더. `z.uuid('역할을 선택해 주세요.')` | `role.id` | 액션 분기(`createAdminRoleAction` / `updateAdminRoleAction`)는 컴포넌트가 `isEdit` 으로 정한다 |
| 키 | 텍스트(`autoFocus`, 추가일 때만 입력칸) | **필수.** 2~31자(`ROLE_KEY_MAX_LENGTH`) + `^[a-z][a-z0-9_]{1,30}$`(마이그레이션 `admin_roles_key_format` 과 같은 식) + `super_admin` 금지. 오류: "키는 2자 이상이어야 합니다." / "키는 31자를 넘을 수 없습니다." / "키는 영문 소문자로 시작하고 영문 소문자·숫자·밑줄만 쓸 수 있습니다." / "이미 사용 중인 키입니다."(예약어 또는 유니크 위반 23505) | 빈 값 | placeholder `content_editor`. 힌트 "영문 소문자로 시작하는 slug. 만든 뒤에는 바꿀 수 없습니다." **수정 화면에서는 입력칸 대신 `키 {key} · 만든 뒤에는 바꿀 수 없습니다.` 안내만** 나온다 — 바꿀 수 있게 두면 이미 남은 감사 로그가 다른 역할을 가리키고 DB 트리거도 되돌린다 |
| 이름 | 텍스트(`maxLength` 30) | **필수** 1~30자(`ROLE_NAME_MAX_LENGTH`). 오류 "이름을 입력해 주세요." / "이름은 30자를 넘을 수 없습니다." | `role.name` | `admin_roles.name`. 목록 표와 관리자 행의 권한 뱃지에 그대로 나온다 |
| 설명 | 텍스트(`maxLength` 120) | 선택 ≤120자(`ROLE_DESCRIPTION_MAX_LENGTH`). 오류 "설명은 120자를 넘을 수 없습니다." | `role.description` | `admin_roles.description`(빈 값은 `null`). 목록 표의 설명 칸 |
| 폼 오류 배너 | `FormBanner` | — | 없음 | 서버 `formError` |
| 취소 / 저장 | 버튼 | 진행 중 `저장 중…` | — | 성공 시 토스트 + 닫힘 |

## 1.2 권한 매트릭스 (`PermissionMatrixField`)

`<fieldset>`(스크린리더용 legend `모듈별 권한`) 안에 머리글 행(`모듈` · `없음` · `읽기` · `쓰기`)과 **모듈 14행**이 들어간다. 목록 영역은 `max-h-[280px]` 스크롤.

| 항목 | 내용 |
|---|---|
| 행(모듈) | `ADMIN_MODULES` 순서 그대로: 대시보드 `dashboard` · 뉴스 `news` · 커뮤니티 `community` · 신고 `reports` · 회원 `members` · 쿠폰 `coupons` · 홈페이지 문의 `inquiries` · FAQ `faqs` · 가이드 `gacha` · 랭킹 `rankings` · 사이트 설정 `settings` · Legal `legal` · 관리자 `admins` · 감사 로그 `audit` |
| 열(등급) | `PERMISSION_LEVELS` = `none`(없음) · `read`(읽기) · `write`(쓰기). **라디오 3개**(체크박스 2개가 아닌 이유: 체크박스면 "읽기는 껐는데 쓰기는 켠" 조합이 만들어지고 그 의미를 아무도 설명할 수 없다. 등급은 서열이므로 하나만 고른다) |
| 필드 이름 | `permission.<module>`(`PERMISSION_FIELD_PREFIX`). 서버는 `readPermissionFields()` 로 이 접두사가 붙은 항목만 모은다 |
| 기본 선택 | 수정: `role.permissions[module] ?? 'none'` / 추가: 전 모듈 **`none`** |
| 접근성 | 라디오마다 `aria-label="{모듈명} {등급명}"` |
| 상태 | **비제어**다 — 폼이 그대로 제출하고 서버가 다시 파싱한다(상태를 들면 라디오 14×3 이 매 클릭마다 리렌더된다) |

**서버 파싱 규칙**(`permissionMatrixSchema` → `toModulePermissions`)
- 값은 `z.enum(['none','read','write'])`("권한 값이 올바르지 않습니다.").
- **빠진 모듈은 `none`**, **모르는 모듈 키는 버린다.** 폼은 14개를 모두 보내므로 실제로는 빠질 일이 없지만, 직접 POST 로 일부만 실어 보내는 요청에서 "열려 있는 쪽으로 기우는 기본값"이 생기면 안 된다.
- 저장되는 값은 항상 14개 키를 모두 가진 객체다(DB `admin_roles_permissions_object` 체크: jsonb object).

**등급의 실제 의미**

| 등급 | 뜻 |
|---|---|
| 없음(`none`) | 사이드바에서 메뉴가 **사라진다**(`visibleNavItems`). 흐리게 남겨 두면 눌러 보고 대시보드로 튕기는 경험을 반복한다. URL 직접 접근은 `requirePermission()` 이 `/?error=forbidden` 으로 되돌린다 |
| 읽기(`read`) | 목록·상세를 볼 수 있다. 쓰기 버튼·폼은 화면에서 빠진다 |
| 쓰기(`write`) | 읽기를 포함한다(`LEVEL_RANK` 비교). 저장·삭제·상태 변경이 열리고, `level:'write'` 로 표시된 하위 메뉴(뉴스 `새 글 작성`·`카테고리 템플릿`, 가이드 `새 아이템`)가 사이드바에 나타난다 |

**`admins` 모듈의 예외** 이 모듈에 `write` 를 줘도 `/admins` 화면은 열리지 않는다 — 화면과 모든 액션이 `requireSuperAdmin()` 이다. 이 등급은 **사이드바에 메뉴가 보이는지**만 좌우한다. 권한 체계 자체를 바꾸는 조작은 역할표로 위임할 수 없다(위임 가능하면 임의의 역할이 스스로를 슈퍼어드민으로 올릴 수 있다).

## 1.3 서버 동작

| 액션 | 검증 | DB 변경 | 감사 | 결과 |
|---|---|---|---|---|
| `createAdminRoleAction` | `requireSuperAdmin()` + `createRoleSchema`(key·name·description) + `permissionMatrixSchema` | `admin_roles` insert(`key`·`name`·`description`·`permissions`) | `admin.role.create`(after `{ key, permissions }`) | 토스트 `{이름} 역할을 만들었습니다.` · 중복 키(23505)면 `key` 필드 오류 "이미 사용 중인 키입니다." · 그 외 "역할을 만들지 못했습니다. 다시 시도해 주세요." |
| `updateAdminRoleAction` | `requireSuperAdmin()` + `updateRoleSchema`(roleId·name·description) + `permissionMatrixSchema` + 대상 존재("역할을 찾을 수 없습니다.") + **`is_system` 이면 "시스템 역할은 수정할 수 없습니다."** | `admin_roles` update(`name`·`description`·`permissions`. **`key` 는 건드리지 않는다**) | `admin.role.update`(before `{permissions: 이전}` / after `{permissions: 새 값}`) | 토스트 `{이름} 역할을 저장했습니다.` · 실패 "역할을 저장하지 못했습니다. 다시 시도해 주세요." |

권한 매트릭스 파싱이 실패하면 두 액션 모두 폼 배너 "권한 값이 올바르지 않습니다. 화면을 새로고침한 뒤 다시 시도해 주세요." 성공 후 `revalidatePath('/admins')`.

**시드 역할 두 개**(`supabase/migrations/20260909000200_admin_roles.sql`)

| key | 이름 | 권한 | 비고 |
|---|---|---|---|
| `super_admin` | 슈퍼어드민 | 전 모듈 `write` | `is_system = true`. 화면에서 수정·삭제 불가. 마이그레이션 재실행 시 값이 다시 덮어써진다 |
| `editor` | 콘텐츠 편집자 | `news`·`community`·`faqs`·`gacha`·`legal` = write / `dashboard`·`reports`·`members`·`inquiries` = read / `rankings`·`settings`·`admins`·`audit` = none | 삭제 가능한 예시 역할 |

시드에는 `coupons` 키가 없다 — `permissionLevel()` 이 값 없는 모듈을 `none` 으로 읽으므로 두 시드 역할 모두 쿠폰 메뉴가 닫혀 있다(슈퍼어드민 포함).

**클라이언트와의 상호작용** 없음(사용자 사이트와 무관, `revalidateClient()` 를 부르지 않는다).

**오류·예외**

- 역할을 바꿔도 이미 로그인해 있는 관리자의 세션은 끊기지 않는다. 권한은 **다음 요청**부터 적용된다(`requireAdmin()` 이 매 요청 `profiles` + `admin_roles` 를 다시 읽는다).
- 전 모듈을 `none` 으로 저장할 수 있다(목록 표에 `권한 없음` 으로 표시). 그 역할을 받은 관리자는 로그인은 되지만 사이드바가 비고 모든 화면이 대시보드로 튕긴다.
- DB 도 같은 규칙을 강제한다: `admin_roles_insert_super`·`_update_super`·`_delete_super` 정책(`is_super_admin()`)과 가드 트리거가 시스템 역할 수정·삭제를 막는다.
- 매트릭스는 스크롤 영역이라 아래쪽 모듈(관리자·감사 로그)을 못 보고 저장하기 쉽다 — 저장은 **화면에 보이지 않는 행까지 전부** 반영한다.
