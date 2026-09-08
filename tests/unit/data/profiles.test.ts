import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseStub } from '../actions/supabase-stub'

import type { SupabaseStub } from '../actions/supabase-stub'

/** `server-only` 는 클라이언트 환경에서 import 되면 예외를 던진다. 테스트에서는 비운다. */
vi.mock('server-only', () => ({}))

let stub: SupabaseStub
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => stub.client }))

const { getAccountProfile } = await import('@/lib/data/profiles')

const USER_ID = 'aaaaaaaa-0000-4000-8000-000000000001'
const PROFILE_ROW = {
  nickname: '모험가',
  provider: 'kakao',
  avatar_url: null,
  created_at: '2026-09-08T00:00:00.000Z',
  terms_agreed_at: '2026-09-08T00:00:00.000Z',
  privacy_agreed_at: '2026-09-08T00:00:00.000Z',
  age_confirmed_at: '2026-09-08T00:00:00.000Z',
  msw_uid: '20123000000000000',
  msw_profile_code: '#abcd1',
}

beforeEach(() => {
  stub = createSupabaseStub([{ data: PROFILE_ROW, error: null }])
})

describe('getAccountProfile', () => {
  it('should query the profiles table for the given user', async () => {
    // Arrange & Act
    await getAccountProfile(USER_ID)

    // Assert
    expect(stub.tables).toEqual(['profiles'])
  })

  it('should return the full account profile row', async () => {
    // Arrange & Act
    const profile = await getAccountProfile(USER_ID)

    // Assert
    expect(profile).toEqual(PROFILE_ROW)
  })

  it('should return null when the profile is missing (trigger failure etc.)', async () => {
    // Arrange
    stub = createSupabaseStub([{ data: null, error: null }])

    // Act
    const profile = await getAccountProfile(USER_ID)

    // Assert — 호출부(온보딩 가드)가 이걸 "미완료"로 취급한다.
    expect(profile).toBeNull()
  })
})
