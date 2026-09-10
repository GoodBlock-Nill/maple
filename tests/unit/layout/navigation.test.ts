import { afterEach, describe, expect, it, vi } from 'vitest'

const ENV_KEY = 'NEXT_PUBLIC_FEATURE_ABOUT_DISABLED'
const ORIGINAL_ENV = process.env[ENV_KEY]

async function importNavigationWithEnv(value: string | undefined) {
  vi.resetModules()

  if (value === undefined) {
    delete process.env[ENV_KEY]
  } else {
    process.env[ENV_KEY] = value
  }

  return import('@/components/layout/navigation')
}

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env[ENV_KEY]
  } else {
    process.env[ENV_KEY] = ORIGINAL_ENV
  }
})

describe('matchesPath', () => {
  it('should match the exact path', async () => {
    const { matchesPath } = await importNavigationWithEnv(undefined)

    expect(matchesPath('/news', '/news')).toBe(true)
  })

  it('should match sub-paths', async () => {
    const { matchesPath } = await importNavigationWithEnv(undefined)

    expect(matchesPath('/news', '/news/1')).toBe(true)
  })

  it('should not match unrelated paths', async () => {
    const { matchesPath } = await importNavigationWithEnv(undefined)

    expect(matchesPath('/news', '/newsletter')).toBe(false)
  })
})

describe('isNavItemHidden', () => {
  it('should hide /about by default (env unset)', async () => {
    const { isNavItemHidden } = await importNavigationWithEnv(undefined)

    expect(isNavItemHidden('/about')).toBe(true)
  })

  it('should not hide other menu items', async () => {
    const { isNavItemHidden } = await importNavigationWithEnv(undefined)

    expect(isNavItemHidden('/news')).toBe(false)
    expect(isNavItemHidden('/community')).toBe(false)
    expect(isNavItemHidden('/guide')).toBe(false)
    expect(isNavItemHidden('/ranking')).toBe(false)
    expect(isNavItemHidden('/support')).toBe(false)
  })

  it('should show /about again when the env var is the literal string "false"', async () => {
    const { isNavItemHidden } = await importNavigationWithEnv('false')

    expect(isNavItemHidden('/about')).toBe(false)
  })
})
