import { describe, expect, it } from 'vitest'

import nextConfig from '@/next.config'
import { SERVER_ACTION_BODY_SIZE_LIMIT } from '@/lib/supabase/storage'

/**
 * 서버 액션 본문 상한.
 *
 * 기본값(1MB)으로 돌아가면 1:1 문의에 사진을 붙인 순간 요청이 액션에 닿기도 전에
 * 500 으로 끊긴다 — 폼 오류가 아니라 오류 화면이라 사용자는 입력을 통째로 잃는다.
 * 설정은 화면 밖에 있어 회귀를 눈으로 못 잡으므로 여기서 붙들어 둔다.
 */
describe('next.config', () => {
  it('should raise the server action body limit above the attachment budget', () => {
    // Arrange & Act
    const limit = nextConfig.experimental?.serverActions?.bodySizeLimit

    // Assert
    expect(limit).toBe(SERVER_ACTION_BODY_SIZE_LIMIT)
  })
})
