import { describe, expect, it } from 'vitest'

import { NEWS_PIN_LIMIT } from '@/lib/constants/news'
import { pinIndicator } from '@/lib/utils/news-pin'

/**
 * 발행 폼 "고정 n/3" 표시 · 체크박스 비활성 판정의 순수 로직.
 *
 * `otherPinnedCount` 는 이 글을 뺀 다른 고정 글 수다(`getPinnedNewsSummary()`
 * 가 이미 자기 자신을 제외하고 센다).
 */
describe('pinIndicator', () => {
  it('should count the checkbox itself when checked', () => {
    expect(pinIndicator(2, true)).toEqual({ count: 3, limit: NEWS_PIN_LIMIT, disabled: false })
  })

  it('should not count the checkbox when unchecked', () => {
    expect(pinIndicator(2, false)).toEqual({ count: 2, limit: NEWS_PIN_LIMIT, disabled: false })
  })

  it('should disable a new pin once the limit is already reached by other posts', () => {
    expect(pinIndicator(3, false).disabled).toBe(true)
  })

  it('should keep an already-pinned post toggleable even when others fill the limit', () => {
    // 이미 고정된 글은 otherPinnedCount 가 한도보다 항상 작다(자기 자신이 3번째다).
    expect(pinIndicator(2, true).disabled).toBe(false)
  })

  it('should never disable while checked, even past the limit (defensive)', () => {
    expect(pinIndicator(5, true).disabled).toBe(false)
  })

  it('should accept a custom limit', () => {
    expect(pinIndicator(1, false, 1)).toEqual({ count: 1, limit: 1, disabled: true })
  })
})
