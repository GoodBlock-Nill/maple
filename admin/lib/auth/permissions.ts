/**
 * 관리자 권한 모델 — 모듈 × (none · read · write).
 *
 * 역할(`admin_roles.permissions`)은 `{ "<module>": "none" | "read" | "write" }` 모양의
 * jsonb 다. DB 는 그 모양만 보증하고(값 검증은 하지 않는다) **의미는 여기서 정한다.**
 * 그래서 이 파일이 모듈 목록의 단일 출처다 — 화면·서버 액션·역할 편집 폼이 모두
 * `ADMIN_MODULES` 를 읽는다.
 *
 * `server-only` 를 붙이지 않는다. 사이드바(클라이언트 컴포넌트)가 같은 판정으로
 * 메뉴를 감춰야 하기 때문이다. 서버 전용 강제는 `require-admin.ts` 가 맡는다.
 *
 * RLS 는 이 모델을 모른다(거친 문 `is_admin()` 하나뿐). 모듈별 강제는 **앱 계층**의
 * `requirePermission()` 이 한다 — 근거는 마이그레이션 20260909000200 의 머리말.
 */

export const PERMISSION_LEVELS = ['none', 'read', 'write'] as const

export type PermissionLevel = (typeof PERMISSION_LEVELS)[number]

/** 화면 문구. 라디오 버튼 세 개의 라벨이 여기서 나온다. */
export const PERMISSION_LEVEL_LABEL: Record<PermissionLevel, string> = {
  none: '없음',
  read: '읽기',
  write: '쓰기',
}

/**
 * 관리 모듈 목록. 마이그레이션의 시드 권한(`super_admin` · `editor`)과 키가 같아야 한다.
 * 여기에 한 줄을 더하면 역할 편집 폼에 행이 하나 늘고, 기존 역할에서는 값이 없으므로
 * `none` 으로 읽힌다(닫힘 실패 — 새 모듈이 자동으로 열리지 않는다).
 */
export const ADMIN_MODULES = [
  { key: 'dashboard', label: '대시보드' },
  { key: 'news', label: '뉴스' },
  { key: 'community', label: '커뮤니티' },
  { key: 'reports', label: '신고' },
  { key: 'members', label: '회원' },
  { key: 'inquiries', label: '1:1 문의' },
  { key: 'faqs', label: 'FAQ' },
  { key: 'gacha', label: '가이드' },
  { key: 'rankings', label: '랭킹' },
  { key: 'settings', label: '사이트 설정' },
  { key: 'legal', label: 'Legal' },
  { key: 'admins', label: '관리자' },
  { key: 'audit', label: '감사 로그' },
] as const

export type AdminModule = (typeof ADMIN_MODULES)[number]['key']

export type ModulePermissions = Partial<Record<AdminModule, PermissionLevel>>

export const ADMIN_MODULE_KEYS: readonly AdminModule[] = ADMIN_MODULES.map((module) => module.key)

/** 슈퍼어드민 역할의 key. 삭제·수정이 막힌 시스템 역할이다(마이그레이션의 가드 트리거). */
export const SUPER_ADMIN_ROLE_KEY = 'super_admin'

/** 등급 비교용 서열. `write` 는 `read` 를 포함한다. */
const LEVEL_RANK: Record<PermissionLevel, number> = { none: 0, read: 1, write: 2 }

export function isPermissionLevel(value: unknown): value is PermissionLevel {
  return PERMISSION_LEVELS.some((level) => level === value)
}

export function isAdminModule(value: unknown): value is AdminModule {
  return ADMIN_MODULE_KEYS.some((module) => module === value)
}

export function moduleLabel(module: AdminModule): string {
  return ADMIN_MODULES.find((entry) => entry.key === module)?.label ?? module
}

/** 값이 없는 모듈은 `none`. 새 모듈이 추가돼도 기존 역할에 자동으로 열리지 않는다. */
export function permissionLevel(
  permissions: ModulePermissions,
  module: AdminModule,
): PermissionLevel {
  return permissions[module] ?? 'none'
}

/**
 * `module` 을 `level` 이상으로 쓸 수 있는가.
 *
 * `write` 를 가진 사람은 `read` 도 통과한다 — 등급을 서열로 비교하지 않으면
 * 모든 호출부가 `=== 'write' || === 'read'` 를 반복하게 되고 한 곳만 빠뜨려도 구멍이 된다.
 */
export function hasPermission(
  permissions: ModulePermissions,
  module: AdminModule,
  level: PermissionLevel,
): boolean {
  return LEVEL_RANK[permissionLevel(permissions, module)] >= LEVEL_RANK[level]
}

/** 여러 모듈 중 하나라도 충족하면 통과. 공유 액션(신고 처리의 콘텐츠 숨김)에 쓴다. */
export function hasAnyPermission(
  permissions: ModulePermissions,
  modules: readonly AdminModule[],
  level: PermissionLevel,
): boolean {
  return modules.some((module) => hasPermission(permissions, module, level))
}

/**
 * DB 의 jsonb 를 앱 타입으로 좁힌다.
 *
 * 모르는 키·모르는 값은 **버린다.** 스키마가 앞서 나가 저장된 값(예: 새 모듈)을
 * 그대로 통과시키면 `permissionLevel` 이 타입에 없는 문자열을 돌려주고, 그 값이
 * 비교에서 조용히 `none` 보다 크게 취급될 수 있다.
 */
export function parsePermissions(value: unknown): ModulePermissions {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const permissions: ModulePermissions = {}

  for (const [key, level] of Object.entries(value as Record<string, unknown>)) {
    if (isAdminModule(key) && isPermissionLevel(level)) {
      permissions[key] = level
    }
  }

  return permissions
}

/** 모든 모듈을 한 등급으로 채운 표. 역할 생성 폼의 기본값과 테스트에 쓴다. */
export function uniformPermissions(level: PermissionLevel): Record<AdminModule, PermissionLevel> {
  return Object.fromEntries(ADMIN_MODULE_KEYS.map((module) => [module, level])) as Record<
    AdminModule,
    PermissionLevel
  >
}

/** 권한 요약 문구. 목록에서 역할이 무엇을 여는지 한 줄로 보여 준다. */
export function summarizePermissions(permissions: ModulePermissions): string {
  const write = ADMIN_MODULE_KEYS.filter(
    (module) => permissionLevel(permissions, module) === 'write',
  )
  const read = ADMIN_MODULE_KEYS.filter((module) => permissionLevel(permissions, module) === 'read')

  if (write.length === ADMIN_MODULE_KEYS.length) {
    return '전체 쓰기'
  }

  const parts: string[] = []

  if (write.length > 0) {
    parts.push(`쓰기 ${write.length}`)
  }

  if (read.length > 0) {
    parts.push(`읽기 ${read.length}`)
  }

  return parts.length === 0 ? '권한 없음' : parts.join(' · ')
}
