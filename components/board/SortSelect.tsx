import { SortMenu } from '@/components/board/SortMenu'
import { COMMUNITY_SORTS } from '@/lib/constants/board'

import type { CommunitySort } from '@/types/domain'

type SortSelectProps = {
  active: CommunitySort
  hrefFor: (sort: CommunitySort) => string
  className?: string
}

/** 커뮤니티 정렬. 표현은 공용 `SortMenu` 가 담당한다. */
export function SortSelect({ active, hrefFor, className }: SortSelectProps) {
  return (
    <SortMenu options={COMMUNITY_SORTS} active={active} hrefFor={hrefFor} className={className} />
  )
}
