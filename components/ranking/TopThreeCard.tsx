import Image from 'next/image'

import { CrownIcon, GuildEmblem, MedalRibbon } from '@/components/ranking/ranking-icons'
import { TopThreeLaurel } from '@/components/ranking/TopThreeLaurel'
import {
  TOP_CHARACTER_BOX_CLASS,
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
        /* 세 카드의 캐릭터는 같은 높이 박스에 담아 크기를 통일한다(1위만 한 단계 크게).
           시안의 샘플 크롭은 원본 크기가 제각각(234~363px)이라 그대로 두면 2위가
           작고 3위가 커 보여 "크기가 부자연스럽다"는 오너 피드백(2026-09-09)이 왔다.
           실데이터의 캐릭터 이미지도 크기를 보장할 수 없으므로 박스 기준이 맞다.
           relative + z-10 은 월계관과의 앞뒤 순서를 rank 별로 뒤집기 위한 것이고,
           min-w-0 은 flex 컨테이너에서 img 기본 min-width(원본 폭)를 풀어 좁은
           패널에서도 object-contain 이 실제로 축소되게 한다. */
        className={cn(
          'relative z-10 w-auto max-w-[90%] min-w-0 object-contain object-bottom',
          entry.rank === 1 ? TOP_CHARACTER_BOX_CLASS.first : TOP_CHARACTER_BOX_CLASS.rest,
        )}
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
