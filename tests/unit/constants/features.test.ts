import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * `FEATURES` 는 모듈 로드 시점에 `process.env` 를 한 번만 읽는다. 값을
 * 바꿔 가며 검증하려면 env 설정 → `vi.resetModules()` → 재 import 순서를
 * 지켜야 한다.
 */
const FEATURE_ENV_KEY = 'NEXT_PUBLIC_FEATURE_MSW_ACCOUNT_FIELDS'
const ORIGINAL_FEATURE_ENV = process.env[FEATURE_ENV_KEY]

async function importFeaturesWithEnv(value: string | undefined) {
  vi.resetModules()

  if (value === undefined) {
    delete process.env[FEATURE_ENV_KEY]
  } else {
    process.env[FEATURE_ENV_KEY] = value
  }

  return import('@/lib/constants/features')
}

afterEach(() => {
  if (ORIGINAL_FEATURE_ENV === undefined) {
    delete process.env[FEATURE_ENV_KEY]
  } else {
    process.env[FEATURE_ENV_KEY] = ORIGINAL_FEATURE_ENV
  }
})

describe('FEATURES.mswAccountFields', () => {
  it('should default to off when the env var is unset', async () => {
    // Arrange & Act
    const { FEATURES } = await importFeaturesWithEnv(undefined)

    // Assert
    expect(FEATURES.mswAccountFields).toBe(false)
  })

  it('should stay off for any value other than the literal string "true"', async () => {
    // Arrange & Act
    const { FEATURES } = await importFeaturesWithEnv('false')

    // Assert
    expect(FEATURES.mswAccountFields).toBe(false)
  })

  it('should turn on only when set to the literal string "true"', async () => {
    // Arrange & Act
    const { FEATURES } = await importFeaturesWithEnv('true')

    // Assert
    expect(FEATURES.mswAccountFields).toBe(true)
  })
})
