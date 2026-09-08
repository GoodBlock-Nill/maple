import type { BoardOption } from '@/lib/constants/board'
import type { GachaGrade, GachaSort, GachaTab } from '@/types/domain'

/** 가이드 목록은 3열 × 5행 = 15건씩 쌓인다(시안 `더보기(15/100)`). */
export const GACHA_PAGE_SIZE = 15

export const GACHA_TABS = [
  { value: 'premium', label: '프리미엄 부화기' },
  { value: 'cube', label: '큐브 / 등급업' },
  { value: 'scroll', label: '주문서 부화기' },
] as const satisfies readonly BoardOption<GachaTab>[]

export const GACHA_SORTS = [
  { value: 'latest', label: '최신순' },
  { value: 'probability', label: '확률순' },
  { value: 'name', label: '이름순' },
] as const satisfies readonly BoardOption<GachaSort>[]

export const GACHA_TAB_VALUES = GACHA_TABS.map((tab) => tab.value)

export const GACHA_SORT_VALUES = GACHA_SORTS.map((sort) => sort.value)

export const DEFAULT_GACHA_TAB: GachaTab = 'premium'

export const DEFAULT_GACHA_SORT: GachaSort = 'latest'

/**
 * 등급 글자색. Tailwind v4 는 클래스 문자열을 정적으로 스캔하므로
 * 보간 없이 완전한 문자열을 값으로 둔다(시안 실측 hex).
 */
export const GACHA_GRADE_CLASS: Record<GachaGrade, string> = {
  SS: 'text-[#ac75e6]',
  S: 'text-[#ee473f]',
  A: 'text-[#ee9513]',
  B: 'text-[#3b82f6]',
  C: 'text-[#727272]',
}

/** 표 4열의 폭 비율(시안 275/327/275/275 = 1152 기준). */
export const GACHA_TABLE_COLUMNS = [
  { key: 'grade', label: '등급', width: '23.87%' },
  { key: 'itemName', label: '획득 아이템명', width: '28.39%' },
  { key: 'probability', label: '확률(%)', width: '23.87%' },
  { key: 'note', label: '비고', width: '23.87%' },
] as const

/** 상세 모달을 여닫는 URL 파라미터 이름. */
export const GACHA_ITEM_PARAM = 'item'
