import Link from 'next/link'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SEARCH_MAX_LENGTH } from '@/lib/constants/field-limits'
import { buildHref, type QueryParams } from '@/lib/utils/table-query'
import { cn } from '@/lib/utils/cn'
import { GACHA_TABS, type GachaTab } from '@/lib/validation/gacha'

/**
 * 탭 · 검색 · 새 아이템.
 *
 * 상태를 갖지 않는 서버 컴포넌트다. 탭은 `<Link>`, 검색은 GET `<form>` 이라
 * 자바스크립트 없이도 목록이 완전히 움직이고 뒤로가기가 그대로 동작한다.
 */
export function GachaToolbar({
  tab,
  q,
  searchParams,
}: {
  tab: GachaTab
  q: string
  searchParams: QueryParams
}) {
  return (
    <div className="mb-4 flex flex-col gap-3">
      <nav aria-label="확률형 아이템 탭" className="border-line flex gap-1 border-b">
        {GACHA_TABS.map((candidate) => {
          const isActive = candidate.value === tab

          return (
            <Link
              key={candidate.value}
              /* 탭을 바꾸면 이전 탭의 페이지 번호·정렬은 의미가 없다. 검색어만 남긴다. */
              href={buildHref('/gacha', { q: searchParams.q }, { tab: candidate.value })}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'rounded-t-panel focus-visible:outline-focus -mb-px border-b-2 px-4 py-2.5 text-[14px] font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2',
                isActive
                  ? 'border-accent text-accent-strong'
                  : 'text-muted hover:text-ink border-transparent',
              )}
            >
              {candidate.label}
            </Link>
          )
        })}
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <form action="/gacha" method="get" className="flex items-end gap-2">
          <input type="hidden" name="tab" value={tab} />
          <Input
            label="아이템 이름 검색"
            name="q"
            type="search"
            defaultValue={q}
            maxLength={SEARCH_MAX_LENGTH}
            countPlacement="label"
            placeholder="아이템 이름 검색"
            wrapperClassName="w-64"
            className="h-9 text-[13px]"
          />
          <Button type="submit" size="sm" variant="secondary">
            검색
          </Button>
        </form>

        <Button href={`/gacha/new?tab=${tab}`} size="sm">
          새 아이템
        </Button>
      </div>
    </div>
  )
}
