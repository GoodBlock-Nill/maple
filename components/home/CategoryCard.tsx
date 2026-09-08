import Image from 'next/image'
import Link from 'next/link'

import { cn } from '@/lib/utils/cn'

import type { CategoryCardItem } from '@/components/home/category-cards'

type CategoryCardProps = {
  card: CategoryCardItem
}

/** 333×482 카드. 아트 PNG(하단 물결 마스크)가 색 패널 위로 겹친다. */
export function CategoryCard({ card }: CategoryCardProps) {
  return (
    <Link
      href={card.href}
      className={cn(
        'card-sheet category-card rounded-card relative mx-auto block aspect-[333/482] w-full max-w-[333px] shrink-0 overflow-hidden',
        'sm:aspect-auto sm:h-[482px] sm:w-[333px] sm:max-w-none',
        'transition-[transform,filter] duration-200 ease-out will-change-transform motion-reduce:transition-none',
        'hover:-translate-y-1.5 hover:rotate-0 focus-visible:-translate-y-1.5 focus-visible:rotate-0',
        card.positionClass,
      )}
    >
      <div
        className={cn(
          'rounded-card absolute inset-x-0 top-[39.7303%] flex h-[60.3734%] flex-col',
          'sm:top-[191.5px] sm:h-[291px]',
          'text-ink px-[30px] pt-[131px] pb-[27px]',
          card.panelClass,
        )}
      >
        <h3 className="text-[35px] leading-none font-semibold tracking-[-0.02em]">{card.title}</h3>
        <p className="mt-[8px] text-[25px] leading-none font-semibold opacity-50">{card.english}</p>
        <span className="mt-auto flex items-center gap-[10px] text-[20px] font-semibold">
          <Image
            src="/images/brand/arrow-card.svg"
            alt=""
            width={42}
            height={42}
            className="size-[41.86px] shrink-0"
          />
          바로가기
        </span>
      </div>

      <Image
        src={card.art}
        alt=""
        width={333}
        height={365}
        sizes="333px"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[75.7261%] w-full sm:h-[365px] sm:w-[333px]"
      />
    </Link>
  )
}
