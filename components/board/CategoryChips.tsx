import { FilterChips } from '@/components/board/FilterChips'
import { ALL_CATEGORY_LABEL } from '@/lib/constants/board'

import type { FilterChipOption } from '@/components/board/FilterChips'
import type { BoardOption } from '@/lib/constants/board'

type CategoryChipsProps<TValue extends string> = {
  items: readonly BoardOption<TValue>[]
  /** null 이면 "전체" 가 활성. */
  active: TValue | null
  /** 칩 값 → 이동할 URL. 나머지 질의 문자열 유지는 호출부 책임. */
  hrefFor: (value: TValue | null) => string
  label: string
}

/** 맨 앞에 "전체"가 붙는 카테고리 칩. 표현은 `FilterChips` 가 담당한다. */
export function CategoryChips<TValue extends string>({
  items,
  active,
  hrefFor,
  label,
}: CategoryChipsProps<TValue>) {
  const options: readonly FilterChipOption<TValue>[] = [
    { value: null, label: ALL_CATEGORY_LABEL },
    ...items.map((item) => ({ value: item.value, label: item.label })),
  ]

  return <FilterChips options={options} active={active} hrefFor={hrefFor} label={label} />
}
