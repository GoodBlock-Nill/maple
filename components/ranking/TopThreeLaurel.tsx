import Image from 'next/image'

import { cn } from '@/lib/utils/cn'

const LAUREL_WIDTH = 272.9
const LAUREL_HEIGHT = 217.7

type TopThreeLaurelProps = {
  className?: string
}

/**
 * TOP3 패널 장식(월계관, opacity .3). 카드 로컬 좌표 (56.3, 12.3)는 고정이고,
 * 캐릭터와의 앞뒤 순서(z-index)만 TopThreeCard 가 rank 별로 지정한다
 * (1위는 캐릭터 위, 2·3위는 캐릭터 아래).
 */
export function TopThreeLaurel({ className }: TopThreeLaurelProps) {
  return (
    <Image
      src="/images/ranking/top3-laurel.png"
      alt=""
      width={LAUREL_WIDTH}
      height={LAUREL_HEIGHT}
      aria-hidden
      /* 패널(overflow-hidden)이 1024 처럼 329.2px(56.3 오프셋 + 272.9 원본 폭)
         보다 좁아지면 고정 폭이 오른쪽으로 잘린다. `max-w-[calc(100%-56.3px)]`
         로 남은 폭만큼만 허용하고 `aspect-*`/`h-auto` 로 세로도 같이 줄여
         비율을 유지한다. 1440 에서는 패널이 항상 그보다 넓어 max-width 가
         272.9px 를 넘으므로 시안 실측 크기가 그대로 유지된다. */
      className={cn(
        'pointer-events-none absolute top-[12.3px] left-[56.3px] aspect-[272.9/217.7] h-auto w-[272.9px] max-w-[calc(100%-56.3px)] object-contain opacity-30',
        className,
      )}
    />
  )
}
