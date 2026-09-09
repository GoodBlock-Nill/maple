import Link from 'next/link'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SEARCH_MAX_LENGTH } from '@/lib/constants/field-limits'
import { buildHref, type QueryParams } from '@/lib/utils/table-query'
import { cn } from '@/lib/utils/cn'
import { GACHA_TABS, type GachaTab } from '@/lib/validation/gacha'

/**
 * 탭 · 검색 · CSV 도구.
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

        <div className="flex flex-wrap items-center gap-2">
          {/* 다운로드는 클라이언트 라우팅 대상이 아니다. `<Link>` 로 두면 라우터가
              RSC 응답을 기대하다 실패한다 — 평범한 앵커로 브라우저에 넘긴다. */}
          <a
            href={`/gacha/export?tab=${tab}`}
            className="rounded-panel border-line bg-surface text-ink hover:bg-page focus-visible:outline-focus inline-flex h-8 items-center justify-center border px-3 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            CSV 내보내기
          </a>
          <Button href={`/gacha/import?tab=${tab}`} size="sm" variant="secondary">
            CSV 가져오기
          </Button>
          <Button href={`/gacha/new?tab=${tab}`} size="sm">
            새 아이템
          </Button>
        </div>
      </div>
    </div>
  )
}
