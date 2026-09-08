import Image from 'next/image'
import Link from 'next/link'

import { BOARD_CARD_CLASS } from '@/components/board/board-styles'
import { cn } from '@/lib/utils/cn'
import { formatDateIso } from '@/lib/utils/format-date'

import type { GachaItem } from '@/types/domain'

type GachaItemCardProps = {
  item: GachaItem
  /** 상세 모달을 여는 URL(`?item=id`). */
  href: string
}

/**
 * 확률형 아이템 카드. 1행 아이콘 + 확률, 2행 아이템명, 3행 갱신일.
 * 카드 전체가 상세 모달을 여는 링크다(모달은 URL 로만 열린다).
 */
export function GachaItemCard({ item, href }: GachaItemCardProps) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(BOARD_CARD_CLASS, 'flex min-h-[189px] flex-col gap-6 p-6')}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="border-line-soft flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border bg-white p-[5px]">
          <Image
            src={item.icon}
            alt=""
            width={52}
            height={48}
            aria-hidden
            className="size-full object-contain"
          />
        </span>
        <span className="text-ink text-[clamp(20px,2.2vw,27px)] leading-none font-medium tracking-[-0.2px]">
          {item.probability}%
        </span>
      </div>

      {/* 시안 카드 높이 189 = 24 + 48 + 24 + 26 + 24 + 19 + 24. 제목 줄 높이를
          26px 로 고정해야 한 줄 제목에서 정확히 189 가 된다. */}
      <h3 className="text-ink line-clamp-2 flex-1 text-[clamp(19px,2vw,27px)] leading-[26px] font-medium tracking-[-0.2px]">
        {item.name}
      </h3>

      <p className="text-ink flex items-center gap-1.5 text-[16px] leading-[19px] font-medium">
        <Image src="/images/brand/icon-clock.svg" alt="" width={12} height={12} aria-hidden />
        <span className="sr-only">갱신일</span>
        {formatDateIso(item.updatedAt)}
      </p>
    </Link>
  )
}
