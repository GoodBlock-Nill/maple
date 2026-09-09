import { z } from 'zod'

import {
  ADMIN_MODULE_KEYS,
  isPermissionLevel,
  PERMISSION_LEVELS,
  SUPER_ADMIN_ROLE_KEY,
  uniformPermissions,
  type AdminModule,
  type PermissionLevel,
} from '@/lib/auth/permissions'
import { EMAIL_MAX_LENGTH } from '@/lib/constants/field-limits'

/**
 * 관리자 초대 · 역할(권한) 폼의 스키마.
 *
 * 서버 액션은 클라이언트 검증을 신뢰하지 않고 여기서 다시 파싱한다. 폼은 같은
 * 스키마의 메시지를 필드 밑에 그대로 그린다.
 */

export const ROLE_KEY_MAX_LENGTH = 31
export const ROLE_NAME_MAX_LENGTH = 30
export const ROLE_DESCRIPTION_MAX_LENGTH = 120

/** 마이그레이션의 `admin_roles_key_format` 체크와 **같은 식**이어야 한다. */
export const ROLE_KEY_PATTERN = /^[a-z][a-z0-9_]{1,30}$/

const emailSchema = z
  .string()
  .trim()
  .min(1, '이메일을 입력해 주세요.')
  .max(EMAIL_MAX_LENGTH, `이메일은 ${EMAIL_MAX_LENGTH}자를 넘을 수 없습니다.`)
  .pipe(z.email('이메일 형식이 올바르지 않습니다.'))

const roleIdSchema = z.uuid('역할을 선택해 주세요.')

const adminIdSchema = z.uuid('대상을 찾을 수 없습니다.')

/**
 * 역할 key — 만든 뒤 바꿀 수 없다.
 *
 * `super_admin` 은 예약어다. 같은 key 로 새 역할을 만들면 유니크 제약에 걸려
 * Postgres 원문이 화면에 나가므로, 그 전에 우리 문구로 막는다.
 */
const roleKeySchema = z
  .string()
  .trim()
  .min(2, '키는 2자 이상이어야 합니다.')
  .max(ROLE_KEY_MAX_LENGTH, `키는 ${ROLE_KEY_MAX_LENGTH}자를 넘을 수 없습니다.`)
  .regex(ROLE_KEY_PATTERN, '키는 영문 소문자로 시작하고 영문 소문자·숫자·밑줄만 쓸 수 있습니다.')
  .refine((value) => value !== SUPER_ADMIN_ROLE_KEY, '이미 사용 중인 키입니다.')

const roleNameSchema = z
  .string()
  .trim()
  .min(1, '이름을 입력해 주세요.')
  .max(ROLE_NAME_MAX_LENGTH, `이름은 ${ROLE_NAME_MAX_LENGTH}자를 넘을 수 없습니다.`)

const roleDescriptionSchema = z
  .string()
  .trim()
  .max(ROLE_DESCRIPTION_MAX_LENGTH, `설명은 ${ROLE_DESCRIPTION_MAX_LENGTH}자를 넘을 수 없습니다.`)

/**
 * 권한 표.
 *
 * 값 검증은 zod 가 하고, "빠진 모듈은 none" 과 "모르는 모듈은 버림"은 변환이 한다.
 * 폼이 라디오를 모두 보내므로 실제로는 빠질 일이 없지만, 직접 POST 로 일부만 실어
 * 보내는 요청에서 **열려 있는 쪽으로 기우는 기본값**이 생기면 안 된다.
 */
export const permissionMatrixSchema = z
  .record(z.string(), z.enum(PERMISSION_LEVELS, { message: '권한 값이 올바르지 않습니다.' }))
  .transform(toModulePermissions)

export const inviteAdminSchema = z.object({
  email: emailSchema,
  roleId: roleIdSchema,
})

export const createRoleSchema = z.object({
  key: roleKeySchema,
  name: roleNameSchema,
  description: roleDescriptionSchema,
})

export const updateRoleSchema = z.object({
  roleId: roleIdSchema,
  name: roleNameSchema,
  description: roleDescriptionSchema,
})

export const changeAdminRoleSchema = z.object({
  adminId: adminIdSchema,
  roleId: roleIdSchema,
})

export const deleteAdminSchema = z.object({
  adminId: adminIdSchema,
})

export type InviteAdminInput = z.infer<typeof inviteAdminSchema>
export type CreateRoleInput = z.infer<typeof createRoleSchema>

/** 권한 라디오의 `name` 접두사. 폼과 파서가 같은 문자열을 봐야 한다. */
export const PERMISSION_FIELD_PREFIX = 'permission.'

/** `permission.<module>` 필드만 골라 표로 만든다. */
export function readPermissionFields(formData: FormData): Record<string, string> {
  const raw: Record<string, string> = {}

  for (const [key, value] of formData.entries()) {
    if (key.startsWith(PERMISSION_FIELD_PREFIX) && typeof value === 'string') {
      raw[key.slice(PERMISSION_FIELD_PREFIX.length)] = value
    }
  }

  return raw
}

function toModulePermissions(
  raw: Record<string, PermissionLevel>,
): Record<AdminModule, PermissionLevel> {
  const permissions = uniformPermissions('none')

  /* 변수 이름을 `module` 로 두면 Next 의 no-assign-module-variable 규칙에 걸린다
     (번들러의 `module` 과 이름이 겹친다). */
  for (const moduleKey of ADMIN_MODULE_KEYS) {
    const level = raw[moduleKey]

    if (isPermissionLevel(level)) {
      permissions[moduleKey] = level
    }
  }

  return permissions
}
