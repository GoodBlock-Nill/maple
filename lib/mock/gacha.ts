import { GACHA_TABS } from '@/lib/constants/guide'

import type { GachaGrade, GachaItem, GachaRow, GachaTab } from '@/types/domain'

/**
 * 확률형 아이템 목업 105건(탭별 35건).
 *
 * 렌더마다 값이 흔들리면 하이드레이션 불일치가 나므로 난수를 쓰지 않고
 * 시드 배열에서 순환 조합해 만든다.
 * Phase 4에서 Supabase `gacha_items` / `gacha_rows` 로 교체된다.
 */

const ITEMS_PER_TAB = 35
const BASE_DATE = Date.UTC(2026, 4, 19, 10, 0, 0)
const DAY_MS = 24 * 60 * 60 * 1000

/** 목록 카드 아이콘 3종을 순환한다. 상세 표 행 아이콘도 같은 자산을 쓴다. */
const ICONS = [
  '/images/guide/icon-item-1.png',
  '/images/guide/icon-item-2.png',
  '/images/guide/icon-item-3.png',
] as const

const NAMES: Record<GachaTab, readonly string[]> = {
  premium: [
    '전설의 용사 뱃지',
    '[캐시] 전설의 펫 랜덤 상자',
    '태초의 정수',
    '프리미엄 부화기 · 별빛',
    '프리미엄 부화기 · 달빛',
  ],
  cube: ['레드 큐브', '블랙 큐브', '에디셔널 큐브', '수상한 큐브', '장인의 등급업 주문서'],
  scroll: [
    '주문서 부화기 · 공격력',
    '주문서 부화기 · 마력',
    '혼돈의 주문서 상자',
    '순수한 힘의 결정',
    '황금 망치 교환권',
  ],
}

const ROW_NAMES: readonly string[] = [
  '핑크빈 펫(영구)',
  '슬라임 펫(90일)',
  '펫 먹이 10개 세트',
  '경험치 2배 쿠폰',
  '강화 주문서 조각',
]

const NOTES: readonly string[] = ['-', '-', '확정지급', '중복 획득 가능', '일일 1회 한정']

const GRADES: readonly GachaGrade[] = ['SS', 'S', 'A', 'B', 'C']

/** 등급별 확률. 마지막 행이 나머지를 흡수해 표 합계가 항상 100.00 이 된다. */
const GRADE_PROBABILITY: readonly number[] = [0.05, 1.5, 18.45, 30]

function pick<TItem>(items: readonly TItem[], index: number): TItem {
  const item = items[index % items.length]

  if (item === undefined) {
    throw new Error('빈 배열에서는 값을 고를 수 없습니다.')
  }

  return item
}

function daysBefore(days: number): string {
  return new Date(BASE_DATE - days * DAY_MS).toISOString()
}

/** 대표 확률: 0.01 ~ 3.27 사이를 35단계로 훑는다. */
function headlineProbability(index: number): string {
  return (0.01 + (index % ITEMS_PER_TAB) * 0.096).toFixed(2)
}

function buildRows(seed: number): readonly GachaRow[] {
  const rowCount = 3 + (seed % 3)
  const leading = GRADE_PROBABILITY.slice(0, rowCount - 1)
  const remainder = 100 - leading.reduce((sum, value) => sum + value, 0)
  const probabilities = [...leading, remainder]

  return Array.from({ length: rowCount }, (_, row) => ({
    grade: pick(GRADES, row),
    itemName: pick(ROW_NAMES, seed + row),
    itemIcon: pick(ICONS, seed + row),
    probability: (probabilities[row] ?? 0).toFixed(2),
    note: pick(NOTES, seed + row),
  }))
}

function buildItem(tab: GachaTab, tabIndex: number, index: number): GachaItem {
  const seed = tabIndex * ITEMS_PER_TAB + index
  const nameBase = pick(NAMES[tab], index)
  // 같은 이름이 반복되지 않도록 두 바퀴째부터 회차를 붙인다.
  const round = Math.floor(index / NAMES[tab].length)
  const name = round === 0 ? nameBase : `${nameBase} ${round + 1}차`

  return {
    id: `${tab}-${index + 1}`,
    tab,
    name,
    icon: pick(ICONS, seed),
    probability: headlineProbability(seed),
    updatedAt: daysBefore(index),
    rows: buildRows(seed),
  }
}

export const GACHA_ITEMS: readonly GachaItem[] = GACHA_TABS.flatMap((tab, tabIndex) =>
  Array.from({ length: ITEMS_PER_TAB }, (_, index) => buildItem(tab.value, tabIndex, index)),
)
