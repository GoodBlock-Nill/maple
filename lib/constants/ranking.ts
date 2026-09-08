import type { BoardOption } from '@/lib/constants/board'
import type { JobGroup, RankingType } from '@/types/domain'

/** 표는 4위부터 10행씩 쌓인다(시안 `더보기(10/100)`). */
export const RANKING_PAGE_SIZE = 10

/** TOP3 카드로 빠지는 상위 인원수. */
export const TOP_RANK_COUNT = 3

export const RANKING_TYPES = [
  { value: 'total', label: '종합 랭킹' },
  { value: 'job', label: '직업 랭킹' },
  { value: 'guild', label: '길드 랭킹' },
] as const satisfies readonly BoardOption<RankingType>[]

export const JOB_GROUPS = [
  { value: 'adventurer', label: '모험가' },
  { value: 'cygnus', label: '시그너스' },
  { value: 'resistance', label: '레지스탕스' },
  { value: 'hero', label: '영웅' },
  { value: 'demon', label: '데몬(마족)' },
] as const satisfies readonly BoardOption<JobGroup>[]

export const RANKING_TYPE_VALUES = RANKING_TYPES.map((type) => type.value)

export const JOB_GROUP_VALUES = JOB_GROUPS.map((group) => group.value)

export const DEFAULT_RANKING_TYPE: RankingType = 'total'

/** 직업 칩 맨 앞의 "전체" 항목 라벨. */
export const ALL_JOB_LABEL = '전체 직업'

/** TOP3 카드 배경 패널 색(1위는 불투명, 2·3위는 50%). */
export const TOP_PANEL_CLASS: readonly string[] = ['bg-top1', 'bg-top2/50', 'bg-top3/50']

/** 메달 리본 색(inline SVG 채우기용). 금 · 은 · 동. */
export const MEDAL_COLORS: readonly { ribbon: string; disc: string; edge: string }[] = [
  { ribbon: '#f2a93b', disc: '#ffd75e', edge: '#e08a1e' },
  { ribbon: '#8f9bb3', disc: '#d7dee9', edge: '#7683a0' },
  { ribbon: '#b9713c', disc: '#e6a874', edge: '#a05c2c' },
]

/** 표 헤더 5열의 폭 비율(시안 120/400/200/220/236 = 1176 기준). */
export const RANKING_COLUMNS = [
  { key: 'rank', label: '순위', width: '10.2%' },
  { key: 'character', label: '캐릭터 정보', width: '34.01%' },
  { key: 'level', label: '레벨', width: '17.01%' },
  { key: 'job', label: '직업', width: '18.71%' },
  { key: 'guild', label: '길드', width: '20.07%' },
] as const
