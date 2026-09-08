import Image from 'next/image'

import { CrownIcon, GuildEmblem, MedalRibbon } from '@/components/ranking/ranking-icons'
import { TopThreeLaurel } from '@/components/ranking/TopThreeLaurel'
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
  const characterImage =
    character === null ? null : (
      <Image
        src={character}
        alt=""
        width={characterSize.width}
        height={characterSize.height}
        aria-hidden
        /* 시안은 크롭 원본 크기 그대로 바닥에 붙인다(패널 높이로 늘리지 않는다).
           relative + z-10 은 월계관과의 앞뒤 순서를 rank 별로 뒤집기 위한 것.
           패널은 flex 컨테이너라 img(대체 요소)의 기본 min-width 가 원본 폭
           (auto)으로 잡혀 max-w-full 이 무시되고, 1024 처럼 패널이 원본보다
           좁아지는 폭에서 오른쪽이 잘렸다 — min-w-0 으로 그 하한을 없애야
           object-contain 이 실제로 축소해 패널 안에 맞는다. 1440 은 패널이
           원본보다 넓어 애초에 축소가 필요 없으므로 렌더 크기가 그대로 유지된다. */
        className="relative z-10 h-auto max-h-full w-auto max-w-full min-w-0 object-contain"
      />
    )

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
        {entry.rank === 1 ? (
          <>
            {/* 1위: 월계관이 캐릭터 위에 덮인다(시안 실측). */}
            {characterImage}
            <TopThreeLaurel className="z-20" />
          </>
        ) : (
          <>
            {/* 2·3위: 월계관이 캐릭터 뒤로 깔린다(시안 실측). */}
            <TopThreeLaurel className="z-0" />
            {characterImage}
          </>
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
