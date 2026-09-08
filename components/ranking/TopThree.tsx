import { TopThreeCard } from '@/components/ranking/TopThreeCard'

import type { RankedEntry } from '@/types/domain'

/** 1위를 가운데로 보내고 좌우를 60px 내리는 데스크톱 배치. */
const DESKTOP_ORDER = ['lg:order-2', 'lg:order-1 lg:mt-[60px]', 'lg:order-3 lg:mt-[60px]']

type TopThreeProps = {
  entries: readonly RankedEntry[]
}

/**
 * TOP3 카드 영역. DOM 순서는 1·2·3위 그대로라 모바일에서는 1위가 먼저 쌓이고,
 * 데스크톱에서만 `order` 로 2·1·3 배치가 된다.
 */
export function TopThree({ entries }: TopThreeProps) {
  if (entries.length === 0) {
    return null
  }

  return (
    <section aria-label="상위 3위" className="mt-6">
      <ol className="flex flex-col gap-6 lg:grid lg:grid-cols-3 lg:items-start lg:gap-4">
        {entries.map((entry, index) => (
          <li key={entry.id} className={DESKTOP_ORDER[index]}>
            <TopThreeCard entry={entry} />
          </li>
        ))}
      </ol>
    </section>
  )
}
