import { describe, expect, it } from 'vitest'

import { optionalEnv, requireEnv } from '@/lib/supabase/env'

describe('requireEnv', () => {
  it('should return the value when it is a non-empty string', () => {
    expect(requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')).toBe(
      'https://example.supabase.co',
    )
  })

  it('should throw with the variable name when the value is undefined', () => {
    expect(() => requireEnv('SUPABASE_SERVICE_ROLE_KEY', undefined)).toThrowError(
      /SUPABASE_SERVICE_ROLE_KEY/u,
    )
  })

  it('should throw when the value is whitespace only', () => {
    expect(() => requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '   ')).toThrowError(
      /NEXT_PUBLIC_SUPABASE_ANON_KEY/u,
    )
  })
})

describe('optionalEnv', () => {
  it('should return the value when set', () => {
    expect(optionalEnv('http://localhost:3000')).toBe('http://localhost:3000')
  })

  it('should return null when unset or blank', () => {
    expect(optionalEnv(undefined)).toBeNull()
    expect(optionalEnv('')).toBeNull()
    expect(optionalEnv('  ')).toBeNull()
  })
})
