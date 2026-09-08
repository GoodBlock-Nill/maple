import type { BoardOption } from '@/lib/constants/board'
import type { JobGroup, RankingType } from '@/types/domain'

/** "더보기" 페이지당 누적 노출 인원(카드 3장 포함, 시안 `더보기(10/100)`). */
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

/**
 * TOP3 캐릭터 크롭의 원본 크기(시안 실측).
 * 카드 패널(244) 높이에 억지로 맞추면 2위 캐릭터가 시안보다 커진다.
 */
export const TOP_CHARACTER_SIZE: Record<string, { width: number; height: number }> = {
  '/images/ranking/top3-char-1.png': { width: 332, height: 243 },
  '/images/ranking/top3-char-2.png': { width: 234, height: 205 },
  '/images/ranking/top3-char-3.png': { width: 363, height: 243 },
}

/** 크기를 모르는 캐릭터 이미지의 기본값. */
export const TOP_CHARACTER_FALLBACK_SIZE = { width: 332, height: 243 } as const

/** TOP3 카드 배경 패널 색(1위는 불투명, 2·3위는 50%). */
export const TOP_PANEL_CLASS: readonly string[] = ['bg-top1', 'bg-top2/50', 'bg-top3/50']

export type MedalPalette = {
  /** 리본 꼬리. */
  tail: string
  /** 원판 테두리. */
  rim: string
  /** 원판 안쪽. */
  disc: string
  /** 숫자. */
  digit: string
}

/**
 * 2·3위 메달 색.
 *
 * 자산 `ranking/medal-ribbon.png` 은 숫자 "1" 이 그려진 금메달 한 장뿐이라
 * CSS 필터로는 2·3위를 만들 수 없다(숫자가 그대로 남는다). 1위는 자산을 쓰고
 * 2·3위만 같은 형태의 인라인 SVG 로 그린다.
 * TODO(asset): 은·동 리본 자산이 오면 SVG 분기를 지운다.
 */
export const MEDAL_PALETTE: Record<number, MedalPalette> = {
  2: { tail: '#8b95a5', rim: '#9aa3b0', disc: '#e2e8f0', digit: '#69727f' },
  3: { tail: '#a4642f', rim: '#b1723c', disc: '#e8b183', digit: '#7f4a20' },
}

/** 표 헤더 5열의 폭 비율(시안 120/400/200/220/236 = 1176 기준). */
export const RANKING_COLUMNS = [
  { key: 'rank', label: '순위', width: '10.2%' },
  { key: 'character', label: '캐릭터 정보', width: '34.01%' },
  { key: 'level', label: '레벨', width: '17.01%' },
  { key: 'job', label: '직업', width: '18.71%' },
  { key: 'guild', label: '길드', width: '20.07%' },
] as const
