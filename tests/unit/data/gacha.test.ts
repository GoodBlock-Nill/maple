import { describe, expect, it, vi } from 'vitest'

// `lib/data/gacha.ts` 는 `lib/supabase/public.ts` 를 거쳐 `server-only` 를
// 임포트한다. jsdom(클라이언트) 테스트 환경에서 그대로 두면 임포트 시점에
// 던져지므로, 순수 매핑(`SORT_RULE`)만 검증하는 이 테스트에서는 무해한
// 스텁으로 대체한다(`tests/unit/data/rankings.test.ts` 와 동일 패턴).
vi.mock('server-only', () => ({}))

import { SORT_RULE } from '@/lib/data/gacha'

describe('SORT_RULE', () => {
  it('should sort by published_at desc only for latest', () => {
    // Arrange & Act
    const rule = SORT_RULE.latest

    // Assert — 공시일 역순. 동률은 호출부의 `.order('id', { ascending: true })` 가 정리한다.
    expect(rule).toEqual([{ column: 'published_at', ascending: false }])
  })

  it('should sort by probability desc then published_at desc for prob_desc', () => {
    // Arrange & Act
    const rule = SORT_RULE.prob_desc

    // Assert
    expect(rule).toEqual([
      { column: 'probability', ascending: false },
      { column: 'published_at', ascending: false },
    ])
  })

  it('should sort by probability asc then published_at desc for prob_asc', () => {
    // Arrange & Act
    const rule = SORT_RULE.prob_asc

    // Assert
    expect(rule).toEqual([
      { column: 'probability', ascending: true },
      { column: 'published_at', ascending: false },
    ])
  })
})
