import Image from 'next/image'

import { CharacterSilhouette, GuildEmblem } from '@/components/ranking/ranking-icons'
import { hasPublicAsset } from '@/lib/utils/asset'
import { cn } from '@/lib/utils/cn'
import { maskNickname } from '@/lib/utils/mask'

import type { RankedEntry } from '@/types/domain'

/**
 * 헤더 행과 공유하는 5열 그리드.
 * 시안 문서의 비율(120/400/200/220/236)은 근사치라, 실제 렌더의 셀 중심을
 * 맞춘 값으로 보정했다. 그리드는 행 카드의 좌우 패딩 없이 시트 내부 폭
 * 전체(1168)를 쓴다.
 * 모바일에서는 뒤 3열이 숨겨지고 `순위 | 캐릭터` 2열만 남는다.
 */
export const RANKING_GRID_CLASS =
  'grid grid-cols-[auto_1fr] items-center gap-4 ' +
  'lg:grid-cols-[92fr_412fr_205fr_238fr_206fr] lg:gap-2'

const VALUE_CLASS = 'text-ink text-[clamp(18px,2vw,26px)] leading-none font-medium'

type RankingRowProps = {
  entry: RankedEntry
}

/**
 * 4위부터의 표 행. 데스크톱은 5열 그리드, 모바일은 2줄 카드
 * (1줄: 순위·아바타·닉네임 / 2줄: 레벨·직업·길드)로 접힌다.
 */
export function RankingRow({ entry }: RankingRowProps) {
  const character =
    entry.character !== undefined && hasPublicAsset(entry.character) ? entry.character : null

  return (
    <li className="rounded-panel border-line-soft shadow-chip flex flex-col gap-3 border bg-white px-4 py-4 sm:px-6 lg:min-h-24 lg:justify-center lg:gap-0 lg:px-0 lg:pr-4 lg:py-6">
      <div className={RANKING_GRID_CLASS}>
        <p className={cn(VALUE_CLASS, 'shrink-0 lg:text-center')}>
          <span className="sr-only">순위 </span>
          {entry.rank}
        </p>

        <div className="flex min-w-0 items-center gap-4 lg:justify-center">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-[15px] p-[3px] drop-shadow-[0_2px_3.5px_rgba(0,0,0,0.25)] lg:size-20">
            {character === null ? (
              /* TODO(asset): 캐릭터 썸네일 자산 도착 전까지 실루엣을 쓴다. */
              <CharacterSilhouette className="text-ink size-full" />
            ) : (
              <Image
                src={character}
                alt=""
                width={80}
                height={80}
                aria-hidden
                className="size-full object-contain"
              />
            )}
          </span>
          <p className={cn(VALUE_CLASS, 'truncate')}>
            <span className="sr-only">캐릭터명 </span>
            {maskNickname(entry.nickname)}
          </p>
        </div>

        <p className={cn(VALUE_CLASS, 'hidden text-center lg:block')}>
          <span className="sr-only">레벨 </span>
          Lv. {entry.level}
        </p>
        <p className={cn(VALUE_CLASS, 'hidden truncate text-center lg:block')}>
          <span className="sr-only">직업 </span>
          {entry.job}
        </p>
        <p className="text-table-body hidden items-center justify-center gap-1.5 text-[17px] leading-none lg:flex">
          <span className="sr-only">길드 </span>
          {entry.guild === null ? (
            '-'
          ) : (
            <>
              <GuildEmblem className="size-10 shrink-0" />
              <span className="truncate">{entry.guild}</span>
            </>
          )}
        </p>
      </div>

      <dl className="text-ink flex flex-wrap items-center gap-x-4 gap-y-1 text-[16px] font-medium lg:hidden">
        <MobileStat label="레벨" value={`Lv. ${entry.level}`} />
        <MobileStat label="직업" value={entry.job} />
        <MobileStat label="길드" value={entry.guild ?? '-'} />
      </dl>
    </li>
  )
}

type MobileStatProps = {
  label: string
  value: string
}

function MobileStat({ label, value }: MobileStatProps) {
  return (
    <div className="flex items-center gap-1.5">
      <dt className="text-ink-muted text-[14px]">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
