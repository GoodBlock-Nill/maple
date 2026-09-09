import { describe, expect, it } from 'vitest'

import { ADMIN_MODULE_KEYS } from '@/lib/auth/permissions'
import {
  changeAdminRoleSchema,
  createRoleSchema,
  inviteAdminSchema,
  permissionMatrixSchema,
  PERMISSION_FIELD_PREFIX,
  readPermissionFields,
  ROLE_KEY_PATTERN,
  updateRoleSchema,
} from '@/lib/validation/admins'

const ROLE_ID = '33333333-3333-4333-8333-333333333333'
const ADMIN_ID = '44444444-4444-4444-8444-444444444444'

function fullMatrix(level: string): Record<string, string> {
  return Object.fromEntries(ADMIN_MODULE_KEYS.map((key) => [key, level]))
}

describe('inviteAdminSchema', () => {
  it('should accept an email and role id', () => {
    const result = inviteAdminSchema.safeParse({ email: ' nill@good-block.com ', roleId: ROLE_ID })

    expect(result.success && result.data.email).toBe('nill@good-block.com')
  })

  it('should reject a malformed email', () => {
    expect(inviteAdminSchema.safeParse({ email: 'nope', roleId: ROLE_ID }).success).toBe(false)
  })

  it('should require a role — an admin with no role can see nothing', () => {
    const result = inviteAdminSchema.safeParse({ email: 'a@b.co', roleId: '' })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('역할을 선택해 주세요.')
  })
})

describe('createRoleSchema — key slug', () => {
  const base = { name: '콘텐츠 편집자', description: '' }

  it('should accept a lowercase slug', () => {
    expect(createRoleSchema.safeParse({ ...base, key: 'content_editor' }).success).toBe(true)
  })

  it('should keep the same pattern as the migration check', () => {
    expect(ROLE_KEY_PATTERN.test('content_editor')).toBe(true)
    expect(ROLE_KEY_PATTERN.test('Content')).toBe(false)
    expect(ROLE_KEY_PATTERN.test('1editor')).toBe(false)
  })

  it('should reject uppercase, spaces, hyphens and leading digits', () => {
    for (const key of ['Editor', 'content editor', 'content-editor', '2editor']) {
      expect(createRoleSchema.safeParse({ ...base, key }).success, key).toBe(false)
    }
  })

  it('should reject the reserved super_admin key', () => {
    const result = createRoleSchema.safeParse({ ...base, key: 'super_admin' })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('이미 사용 중인 키입니다.')
  })

  it('should require a name', () => {
    expect(createRoleSchema.safeParse({ key: 'editor', name: '  ', description: '' }).success).toBe(
      false,
    )
  })
})

describe('updateRoleSchema', () => {
  it('should not accept a key — it is immutable after creation', () => {
    const result = updateRoleSchema.safeParse({
      roleId: ROLE_ID,
      name: '편집자',
      description: '',
      key: 'something_else',
    })

    expect(result.success).toBe(true)
    expect(result.success && 'key' in result.data).toBe(false)
  })
})

describe('permissionMatrixSchema', () => {
  it('should accept a full matrix', () => {
    const result = permissionMatrixSchema.safeParse(fullMatrix('write'))

    expect(result.success && result.data.audit).toBe('write')
  })

  it('should default missing modules to none (fail closed)', () => {
    const result = permissionMatrixSchema.safeParse({ news: 'write' })

    expect(result.success).toBe(true)
    expect(result.success && result.data.news).toBe('write')
    expect(result.success && result.data.settings).toBe('none')
  })

  it('should drop modules that do not exist', () => {
    const result = permissionMatrixSchema.safeParse({ news: 'write', wallet: 'write' })

    expect(result.success).toBe(true)
    expect(result.success && Object.keys(result.data)).toHaveLength(ADMIN_MODULE_KEYS.length)
  })

  it('should reject an unknown level instead of silently downgrading it', () => {
    expect(permissionMatrixSchema.safeParse({ news: 'owner' }).success).toBe(false)
  })
})

describe('readPermissionFields', () => {
  it('should pick only the prefixed fields', () => {
    const formData = new FormData()
    formData.set('name', '편집자')
    formData.set(`${PERMISSION_FIELD_PREFIX}news`, 'write')
    formData.set(`${PERMISSION_FIELD_PREFIX}audit`, 'none')

    expect(readPermissionFields(formData)).toEqual({ news: 'write', audit: 'none' })
  })
})

describe('changeAdminRoleSchema', () => {
  it('should require both ids to be uuids', () => {
    expect(changeAdminRoleSchema.safeParse({ adminId: ADMIN_ID, roleId: ROLE_ID }).success).toBe(
      true,
    )
    expect(changeAdminRoleSchema.safeParse({ adminId: 'nope', roleId: ROLE_ID }).success).toBe(
      false,
    )
  })
})
