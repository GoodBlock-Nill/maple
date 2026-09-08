import Image from 'next/image'

import { GachaGradeTable } from '@/components/guide/GachaGradeTable'
import { GachaModalShell } from '@/components/guide/GachaModalShell'
import { formatDateIso } from '@/lib/utils/format-date'

import type { GachaItem } from '@/types/domain'

const TITLE_ID = 'gacha-detail-title'

type GachaDetailModalProps = {
  item: GachaItem
  closeHref: string
}

/**
 * 확률 상세 모달(시안 1200×417). 마크업은 서버에서 만들고, 여닫기와 포커스
 * 관리만 `GachaModalShell` 이 클라이언트에서 담당한다.
 */
export function GachaDetailModal({ item, closeHref }: GachaDetailModalProps) {
  return (
    <GachaModalShell closeHref={closeHref} labelledBy={TITLE_ID}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-6">
          <div className="flex items-start justify-between gap-4 pr-10">
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
            <span className="text-ink text-[24px] leading-none font-medium">
              {item.probability}%
            </span>
          </div>
          <h2 id={TITLE_ID} className="text-ink text-[24px] leading-[1.3] font-medium">
            {item.name}
          </h2>
        </div>

        <GachaGradeTable rows={item.rows} caption={item.name} />

        <p className="text-ink flex items-center gap-1.5 text-[16px] leading-[19px] font-medium">
          <Image src="/images/brand/icon-clock.svg" alt="" width={12} height={12} aria-hidden />
          <span className="sr-only">갱신일</span>
          {formatDateIso(item.updatedAt)}
        </p>
      </div>
    </GachaModalShell>
  )
}
