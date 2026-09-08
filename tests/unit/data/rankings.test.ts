import { describe, expect, it, vi } from 'vitest'

// `lib/data/rankings.ts` 는 `lib/supabase/public.ts` 를 거쳐 `server-only` 를
// 임포트한다. jsdom(클라이언트) 테스트 환경에서 그대로 두면 임포트 시점에
// 던져지므로, 순수 함수(`toRankingPage`)만 검증하는 이 테스트에서는 무해한
// 스텁으로 대체한다.
vi.mock('server-only', () => ({}))

import { toRankingPage } from '@/lib/data/rankings'

import type { RankedEntry } from '@/types/domain'

/** id/rank 외 값은 화면 분기에 쓰이지 않으므로 고정값으로 채운다. */
function buildEntries(count: number): RankedEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `entry-${index + 1}`,
    nickname: `캐릭터${index + 1}`,
    level: 200,
    job: '히어로',
    jobGroup: 'hero',
    exp: '0',
    guild: null,
    rank: index + 1,
  }))
}

describe('toRankingPage', () => {
  it('should show top3 cards plus 7 table rows (10 total) on the first page', () => {
    // Arrange — 100명 중 첫 page 응답으로 10건만 조회된 상황
    const ranked = buildEntries(10)

    // Act
    const result = toRankingPage(ranked, 100, 1)

    // Assert — 시안: TOP3 + 표 7행 = 10건, 더보기(10/100)
    expect(result.top).toHaveLength(3)
    expect(result.rows).toHaveLength(7)
    expect(result.rows[0]?.rank).toBe(4)
    expect(result.rows.at(-1)?.rank).toBe(10)
    expect(result.shown).toBe(10)
    expect(result.total).toBe(100)
    expect(result.hasMore).toBe(true)
  })

  it('should accumulate to 20 shown with 17 table rows on the second page', () => {
    // Arrange — page=2 는 1~20건을 누적으로 다시 읽어온다
    const ranked = buildEntries(20)

    // Act
    const result = toRankingPage(ranked, 100, 2)

    // Assert — TOP3 + 표 17행 = 20건, 더보기(20/100)
    expect(result.top).toHaveLength(3)
    expect(result.rows).toHaveLength(17)
    expect(result.rows.at(-1)?.rank).toBe(20)
    expect(result.shown).toBe(20)
    expect(result.hasMore).toBe(true)
  })

  it('should clamp shown to total and hide the load-more button on the last page', () => {
    // Arrange — 전체 인원이 25명뿐이라 3페이지째에는 남는 행이 없다
    const ranked = buildEntries(25)

    // Act
    const result = toRankingPage(ranked, 25, 3)

    // Assert
    expect(result.shown).toBe(25)
    expect(result.rows).toHaveLength(22)
    expect(result.hasMore).toBe(false)
  })

  it('should keep every entry as a top card when the population is smaller than 3', () => {
    // Arrange — 카드보다 인원이 적은 극단값
    const ranked = buildEntries(2)

    // Act
    const result = toRankingPage(ranked, 2, 1)

    // Assert
    expect(result.top).toHaveLength(2)
    expect(result.rows).toHaveLength(0)
    expect(result.shown).toBe(2)
    expect(result.hasMore).toBe(false)
  })

  it('should fall back to the fetched length when count is null', () => {
    // Arrange — count 조회 실패 시 받은 행 수를 전체로 간주한다
    const ranked = buildEntries(5)

    // Act
    const result = toRankingPage(ranked, null, 1)

    // Assert
    expect(result.total).toBe(5)
    expect(result.shown).toBe(5)
    expect(result.rows).toHaveLength(2)
    expect(result.hasMore).toBe(false)
  })
})
