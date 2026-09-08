import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * `FEATURES` 는 모듈 로드 시점에 `process.env` 를 한 번만 읽는다. 값을
 * 바꿔 가며 검증하려면 env 설정 → `vi.resetModules()` → 재 import 순서를
 * 지켜야 한다.
 */
const FEATURE_ENV_KEYS = [
  'NEXT_PUBLIC_FEATURE_MSW_ACCOUNT_FIELDS',
  'NEXT_PUBLIC_FEATURE_GUIDE_COMING_SOON',
  'NEXT_PUBLIC_FEATURE_RANKING_COMING_SOON',
] as const

type FeatureEnvKey = (typeof FEATURE_ENV_KEYS)[number]

const ORIGINAL_ENV: Record<FeatureEnvKey, string | undefined> = Object.fromEntries(
  FEATURE_ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<FeatureEnvKey, string | undefined>

async function importFeaturesWithEnv(overrides: Partial<Record<FeatureEnvKey, string>>) {
  vi.resetModules()

  for (const key of FEATURE_ENV_KEYS) {
    const value = overrides[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  return import('@/lib/constants/features')
}

afterEach(() => {
  for (const key of FEATURE_ENV_KEYS) {
    const original = ORIGINAL_ENV[key]
    if (original === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = original
    }
  }
})

describe('FEATURES.mswAccountFields', () => {
  it('should default to off when the env var is unset', async () => {
    // Arrange & Act
    const { FEATURES } = await importFeaturesWithEnv({})

    // Assert
    expect(FEATURES.mswAccountFields).toBe(false)
  })

  it('should stay off for any value other than the literal string "true"', async () => {
    // Arrange & Act
    const { FEATURES } = await importFeaturesWithEnv({
      NEXT_PUBLIC_FEATURE_MSW_ACCOUNT_FIELDS: 'false',
    })

    // Assert
    expect(FEATURES.mswAccountFields).toBe(false)
  })

  it('should turn on only when set to the literal string "true"', async () => {
    // Arrange & Act
    const { FEATURES } = await importFeaturesWithEnv({
      NEXT_PUBLIC_FEATURE_MSW_ACCOUNT_FIELDS: 'true',
    })

    // Assert
    expect(FEATURES.mswAccountFields).toBe(true)
  })
})

// 오너 요청: 가이드(확률형 아이템 정보)·랭킹은 9/18 오픈 시점에 미제공 —
// 두 플래그 모두 기본값이 꺼져 있어야 "서비스 준비 중" 화면이 뜬다.
describe('FEATURES.guideOpen / FEATURES.rankingOpen', () => {
  it('should default both pages to open when the coming-soon env vars are unset', async () => {
    // Arrange & Act
    const { FEATURES } = await importFeaturesWithEnv({})

    // Assert
    expect(FEATURES.guideOpen).toBe(true)
    expect(FEATURES.rankingOpen).toBe(true)
  })

  it('should stay open for any value other than the literal string "true"', async () => {
    // Arrange & Act
    const { FEATURES } = await importFeaturesWithEnv({
      NEXT_PUBLIC_FEATURE_GUIDE_COMING_SOON: 'yes',
      NEXT_PUBLIC_FEATURE_RANKING_COMING_SOON: '1',
    })

    // Assert
    expect(FEATURES.guideOpen).toBe(true)
    expect(FEATURES.rankingOpen).toBe(true)
  })

  it('should close guide only when NEXT_PUBLIC_FEATURE_GUIDE_COMING_SOON is "true"', async () => {
    // Arrange & Act
    const { FEATURES } = await importFeaturesWithEnv({ NEXT_PUBLIC_FEATURE_GUIDE_COMING_SOON: 'true' })

    // Assert
    expect(FEATURES.guideOpen).toBe(false)
    expect(FEATURES.rankingOpen).toBe(true)
  })

  it('should close ranking only when NEXT_PUBLIC_FEATURE_RANKING_COMING_SOON is "true"', async () => {
    // Arrange & Act
    const { FEATURES } = await importFeaturesWithEnv({ NEXT_PUBLIC_FEATURE_RANKING_COMING_SOON: 'true' })

    // Assert
    expect(FEATURES.rankingOpen).toBe(false)
    expect(FEATURES.guideOpen).toBe(true)
  })
})
