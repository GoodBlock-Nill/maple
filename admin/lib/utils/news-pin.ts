import { NEWS_PIN_LIMIT } from '@/lib/constants/news'

/**
 * 발행 폼의 "고정 n/3" 표시 · 체크박스 비활성 여부를 계산하는 순수 함수.
 *
 * `otherPinnedCount` 는 **이 글을 뺀** 다른 고정 글 수다(`getPinnedNewsSummary()`
 * 가 이미 자기 자신을 제외하고 센다). 체크돼 있으면 이 글도 분자에 하나 더한다.
 *
 * 이미 고정된 글(수정 화면에서 `defaultPinned = true`)은 `otherPinnedCount` 가
 * 한도보다 항상 작다 — 한도(3)가 자기 자신까지 포함한 값이기 때문이다. 그래서
 * "체크 해제만 막는" 일 없이 정상적으로 토글할 수 있다. 비활성은 "아직 체크하지
 * 않았는데 이미 한도에 닿았을 때"만 켠다 — 그래야 이미 고정된 3개는 계속 풀 수
 * 있고, 4번째만 새로 못 켠다.
 */
export type PinIndicator = {
  /** 지금 체크 상태를 반영한 "실제로 몇 개가 고정될지". */
  count: number
  limit: number
  disabled: boolean
}

export function pinIndicator(
  otherPinnedCount: number,
  checked: boolean,
  limit: number = NEWS_PIN_LIMIT,
): PinIndicator {
  return {
    count: otherPinnedCount + (checked ? 1 : 0),
    limit,
    disabled: !checked && otherPinnedCount >= limit,
  }
}
