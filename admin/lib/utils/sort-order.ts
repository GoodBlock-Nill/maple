/**
 * ▲▼ 정렬의 공통 규칙.
 *
 * FAQ 가 먼저 쓰던 규칙을 그대로 끌어올린 것이다(`lib/validation/faqs.ts` 가 여기에
 * 위임한다). 문의 카테고리도 같은 조작(▲▼ → '순서 저장')을 하므로 알고리즘을 두 벌로
 * 두지 않는다 — 한쪽만 고쳐지면 같은 버튼이 화면마다 다르게 움직인다.
 *
 * 핵심은 "화면에 보이는 배열을 그대로 0..n-1 로 다시 쓴다"이다. 자리를 바꾼 두 행의
 * 값만 맞바꾸면 기존 데이터에 중복·구멍(0,0,5,5)이 있을 때 결과가 눈에 보이는 것과
 * 달라진다.
 */

export type OrderItem = {
  id: string
  sortOrder: number
}

export type MoveDirection = 'up' | 'down'

/** 화면에 보이는 순서를 그대로 `sort_order` 로 굳힌다. */
export function normalizeOrder(ids: readonly string[]): readonly OrderItem[] {
  return ids.map((id, index) => ({ id, sortOrder: index }))
}

/**
 * 한 칸 위/아래로 옮긴 뒤 0부터 다시 매긴다.
 * 끝에서 더 밀면 원본을 그대로 돌려준다(호출부는 저장할 변경이 없다고 판단한다).
 */
export function moveOrder(
  items: readonly OrderItem[],
  id: string,
  direction: MoveDirection,
): readonly OrderItem[] {
  const index = items.findIndex((item) => item.id === id)
  const target = direction === 'up' ? index - 1 : index + 1

  if (index === -1 || target < 0 || target >= items.length) {
    return items
  }

  const next = [...items]
  const moved = next[index]
  const swapped = next[target]

  if (moved === undefined || swapped === undefined) {
    return items
  }

  next[index] = swapped
  next[target] = moved

  return normalizeOrder(next.map((item) => item.id))
}

/** 저장할 값이 있는지(= 순서가 실제로 바뀌었는지) 판정한다. */
export function hasOrderChanged(
  original: readonly OrderItem[],
  next: readonly OrderItem[],
): boolean {
  if (original.length !== next.length) {
    return true
  }

  return original.some((item, index) => next[index]?.id !== item.id)
}
