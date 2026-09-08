import Image from 'next/image'

import { CrownIcon, GuildEmblem, MedalRibbon } from '@/components/ranking/ranking-icons'
import {
  TOP_CHARACTER_FALLBACK_SIZE,
  TOP_CHARACTER_SIZE,
  TOP_PANEL_CLASS,
} from '@/lib/constants/ranking'
import { hasPublicAsset } from '@/lib/utils/asset'
import { cn } from '@/lib/utils/cn'

import type { RankedEntry } from '@/types/domain'

const STAT_LABELS = ['레벨', '직업', '경험치'] as const

type TopThreeCardProps = {
  entry: RankedEntry
  className?: string
}

/** TOP3 카드 1장. 상단 배경 패널 + 캐릭터, 하단 정보 블록. */
export function TopThreeCard({ entry, className }: TopThreeCardProps) {
  const panelClass = TOP_PANEL_CLASS[entry.rank - 1] ?? TOP_PANEL_CLASS[0]
  const stats = [`Lv. ${entry.level}`, entry.job, entry.exp]
  const character =
    entry.character !== undefined && hasPublicAsset(entry.character) ? entry.character : null
  const characterSize =
    character === null
      ? TOP_CHARACTER_FALLBACK_SIZE
      : (TOP_CHARACTER_SIZE[character] ?? TOP_CHARACTER_FALLBACK_SIZE)

  return (
    <article
      className={cn(
        'rounded-panel border-line-soft shadow-top3 relative flex flex-col border bg-white',
        className,
      )}
    >
      <MedalRibbon rank={entry.rank} className="absolute -top-[35px] left-[22px] z-10" />

      <div
        className={cn(
          'relative flex h-[244px] items-end justify-center overflow-hidden rounded-t-[19px]',
          panelClass,
        )}
      >
        {character === null ? null : (
          <Image
            src={character}
            alt=""
            width={characterSize.width}
            height={characterSize.height}
            aria-hidden
            /* 시안은 크롭 원본 크기 그대로 바닥에 붙인다(패널 높이로 늘리지 않는다). */
            className="h-auto max-h-full w-auto max-w-full object-contain"
          />
        )}
      </div>

      <div className="flex flex-col gap-6 px-6 py-[15px]">
        {/* 이름 행 높이 35 = 길드 아이콘(32×35). 시안 카드 높이 395 =
            244(패널) + 15 + 35 + 24 + 17 + 24 + 17 + 15. */}
        <div className="flex min-h-[35px] items-center justify-between gap-3">
          <h3 className="text-ink flex min-w-0 items-center gap-1.5 text-[clamp(20px,2.2vw,27px)] leading-tight font-medium">
            {entry.rank === 1 ? <CrownIcon className="h-[30px] w-[31px] shrink-0" /> : null}
            <span className="truncate">{entry.nickname}</span>
          </h3>
          {entry.guild === null ? (
            <span className="text-table-body text-[16px]">-</span>
          ) : (
            <span className="text-table-body flex shrink-0 items-center gap-1 text-[16px]">
              <GuildEmblem className="h-[35px] w-8 shrink-0" />
              {entry.guild}
            </span>
          )}
        </div>

        <dl className="grid grid-cols-3 gap-2 text-center">
          {STAT_LABELS.map((label, index) => (
            <div key={label} className="flex flex-col gap-6">
              <dt className="text-ink-muted text-[17px] leading-none">{label}</dt>
              <dd className="text-ink text-[17px] leading-none">{stats[index]}</dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  )
}
