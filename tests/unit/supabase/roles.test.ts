import { describe, expect, it } from 'vitest'

import { ADMIN_ROLE, isAdminRole, isUserRole, USER_ROLES } from '@/lib/supabase/roles'

describe('USER_ROLES', () => {
  it('should stay in sync with the user_role enum in the migrations', () => {
    expect([...USER_ROLES]).toEqual(['user', 'admin'])
  })
})

describe('isUserRole', () => {
  it('should accept known roles', () => {
    expect(isUserRole('user')).toBe(true)
    expect(isUserRole('admin')).toBe(true)
  })

  it('should reject unknown values', () => {
    expect(isUserRole('superadmin')).toBe(false)
    expect(isUserRole('')).toBe(false)
    expect(isUserRole(null)).toBe(false)
    expect(isUserRole(undefined)).toBe(false)
    expect(isUserRole(1)).toBe(false)
  })
})

describe('isAdminRole', () => {
  it('should return true only for the admin role', () => {
    expect(isAdminRole(ADMIN_ROLE)).toBe(true)
    expect(isAdminRole('user')).toBe(false)
  })

  it('should return false for missing values', () => {
    expect(isAdminRole(null)).toBe(false)
    expect(isAdminRole(undefined)).toBe(false)
    expect(isAdminRole('')).toBe(false)
  })

  it('should be case sensitive so that "Admin" never passes', () => {
    expect(isAdminRole('Admin')).toBe(false)
    expect(isAdminRole('ADMIN')).toBe(false)
  })
})
