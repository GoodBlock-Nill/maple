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
    /* 시안: 툴바 아래 44px 부터 TOP3 영역(1200×489)이 시작하고 그 위쪽 31px 은
       메달 리본이 카드 밖으로 걸치는 공간이다 → 카드 자체는 툴바에서 75px 아래. */
    <section aria-label="상위 3위" className="mt-10 xl:mt-[75px]">
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
