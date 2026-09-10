import { describe, expect, it } from 'vitest'

import {
  ADMIN_MODULE_KEYS,
  ADMIN_MODULES,
  hasAnyPermission,
  hasPermission,
  isAdminModule,
  isPermissionLevel,
  moduleLabel,
  parsePermissions,
  permissionLevel,
  summarizePermissions,
  uniformPermissions,
} from '@/lib/auth/permissions'

/**
 * 권한 판정의 세 가지 계약.
 *   1) 값이 없는 모듈은 **닫혀** 있다(none). 새 모듈이 자동으로 열리면 안 된다.
 *   2) `write` 는 `read` 를 포함한다 — 등급은 서열이다.
 *   3) DB 에서 온 jsonb 의 모르는 키·값은 버린다(타입에 없는 값이 비교에 섞이지 않게).
 */

describe('permissionLevel', () => {
  it('should read a stored level', () => {
    expect(permissionLevel({ news: 'write' }, 'news')).toBe('write')
  })

  it('should default a missing module to none', () => {
    expect(permissionLevel({}, 'news')).toBe('none')
  })
})

describe('hasPermission', () => {
  it('should let write satisfy read', () => {
    expect(hasPermission({ news: 'write' }, 'news', 'read')).toBe(true)
    expect(hasPermission({ news: 'write' }, 'news', 'write')).toBe(true)
  })

  it('should not let read satisfy write', () => {
    expect(hasPermission({ news: 'read' }, 'news', 'write')).toBe(false)
    expect(hasPermission({ news: 'read' }, 'news', 'read')).toBe(true)
  })

  it('should refuse everything for none', () => {
    expect(hasPermission({ news: 'none' }, 'news', 'read')).toBe(false)
    expect(hasPermission({}, 'news', 'read')).toBe(false)
  })

  it('should not leak one module permission into another', () => {
    expect(hasPermission({ news: 'write' }, 'members', 'read')).toBe(false)
  })
})

describe('hasAnyPermission', () => {
  it('should pass when at least one module qualifies', () => {
    expect(hasAnyPermission({ reports: 'write' }, ['community', 'reports'], 'write')).toBe(true)
  })

  it('should fail when none qualifies', () => {
    expect(hasAnyPermission({ reports: 'read' }, ['community', 'reports'], 'write')).toBe(false)
  })
})

describe('parsePermissions', () => {
  it('should keep known module/level pairs', () => {
    expect(parsePermissions({ news: 'write', members: 'read' })).toEqual({
      news: 'write',
      members: 'read',
    })
  })

  it('should drop unknown modules and unknown levels', () => {
    expect(parsePermissions({ news: 'write', wallet: 'write', members: 'admin' })).toEqual({
      news: 'write',
    })
  })

  it('should return an empty table for non-objects', () => {
    expect(parsePermissions(null)).toEqual({})
    expect(parsePermissions('write')).toEqual({})
    expect(parsePermissions(['write'])).toEqual({})
  })
})

describe('ADMIN_MODULES', () => {
  it('should cover every module the migration seeds', () => {
    expect([...ADMIN_MODULE_KEYS]).toEqual([
      'dashboard',
      'news',
      'community',
      'reports',
      'members',
      'coupons',
      'inquiries',
      'faqs',
      'gacha',
      'rankings',
      'settings',
      'legal',
      'admins',
      'audit',
    ])
  })

  it('should give every module a korean label', () => {
    for (const entry of ADMIN_MODULES) {
      expect(entry.label.length).toBeGreaterThan(0)
      expect(moduleLabel(entry.key)).toBe(entry.label)
    }
  })

  it('should narrow only known keys and levels', () => {
    expect(isAdminModule('news')).toBe(true)
    expect(isAdminModule('wallet')).toBe(false)
    expect(isPermissionLevel('write')).toBe(true)
    expect(isPermissionLevel('admin')).toBe(false)
  })
})

describe('uniformPermissions', () => {
  it('should fill every module with the given level', () => {
    const all = uniformPermissions('write')

    expect(Object.keys(all)).toHaveLength(ADMIN_MODULE_KEYS.length)
    expect(hasPermission(all, 'audit', 'write')).toBe(true)
  })
})

describe('summarizePermissions', () => {
  it('should call out a full-write role', () => {
    expect(summarizePermissions(uniformPermissions('write'))).toBe('전체 쓰기')
  })

  it('should count write and read modules', () => {
    expect(summarizePermissions({ news: 'write', members: 'read', audit: 'none' })).toBe(
      '쓰기 1 · 읽기 1',
    )
  })

  it('should say so when nothing is open', () => {
    expect(summarizePermissions({})).toBe('권한 없음')
  })
})
