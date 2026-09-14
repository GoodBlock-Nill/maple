import { describe, expect, it } from 'vitest'

import nextConfig from '@/next.config'
import { SERVER_ACTION_BODY_SIZE_LIMIT } from '@/lib/supabase/storage'

/**
 * 서버 액션 본문 상한.
 *
 * 첨부는 더 이상 본문에 실리지 않는다(2026-09-14 — 전부 브라우저가 버킷으로 직접
 * 올린다). 그래도 값이 설정에서 빠지면 기본값(1MB)으로 돌아가고, 프리필 양식을 가득
 * 채운 긴 문의가 액션에 닿기도 전에 끊긴다. 설정은 화면 밖에 있어 회귀를 눈으로 못
 * 잡으므로 여기서 붙들어 둔다.
 */
describe('next.config', () => {
  it('should pin the server action body limit to the shared constant', () => {
    // Arrange & Act
    const limit = nextConfig.experimental?.serverActions?.bodySizeLimit

    // Assert
    expect(limit).toBe(SERVER_ACTION_BODY_SIZE_LIMIT)
  })
})
