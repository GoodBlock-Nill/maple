import Link from 'next/link'

import { Button, Input } from '@/components/ui'
import { SEARCH_MAX_LENGTH } from '@/lib/constants/field-limits'
import { cn } from '@/lib/utils/cn'
import { buildHref, firstValue, type QueryParams } from '@/lib/utils/table-query'
import { INQUIRY_CATEGORIES, INQUIRY_STATUS_TABS } from '@/lib/validation/inquiries'

import type { InquiryTabCounts } from '@/lib/data/inquiries'
import type { InquiryFilters as Filters } from '@/lib/validation/inquiries'

const LIST_PATH = '/inquiries'

/**
 * 목록 필터 — 상태 탭 + 조건 폼.
 *
 * 상태 탭은 `<Link>`, 나머지는 **GET 폼**이다. 둘 다 자바스크립트 없이 동작하고,
 * 결과가 그대로 주소에 남아 새로고침·뒤로가기·링크 공유가 같은 화면을 낸다.
 * 정렬(`sort`)은 폼의 hidden 으로 실어 보내 조건을 바꿔도 유지되게 하고,
 * 페이지 번호는 일부러 싣지 않는다 — 조건이 바뀌면 3페이지는 의미를 잃는다.
 */
export function InquiryFilters({
  params,
  filters,
  counts,
}: {
  params: QueryParams
  filters: Filters
  counts: InquiryTabCounts
}) {
  const sort = firstValue(params.sort)

  return (
    <div className="mb-4 flex flex-col gap-3">
      <nav aria-label="상태" className="flex flex-wrap gap-1.5">
        {INQUIRY_STATUS_TABS.map((tab) => {
          const isActive = tab.value === filters.tab

          return (
            <Link
              key={tab.value}
              href={buildHref(LIST_PATH, params, { status: tab.value, page: null })}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'rounded-pill inline-flex items-center gap-1.5 border px-3 py-1.5 text-[13px] font-semibold',
                'focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-2',
                isActive
                  ? 'border-accent bg-accent text-white'
                  : 'border-line bg-surface text-muted hover:text-ink hover:bg-page',
              )}
            >
              {tab.label}
              <span className={cn('text-[12px]', isActive ? 'text-white/80' : 'text-muted')}>
                {counts[tab.value]}
              </span>
            </Link>
          )
        })}
      </nav>

      <form
        action={LIST_PATH}
        method="get"
        className="border-line bg-surface rounded-card flex flex-wrap items-end gap-2 border px-4 py-3"
      >
        <input type="hidden" name="status" value={filters.tab} />
        {sort !== null && <input type="hidden" name="sort" value={sort} />}

        <label className="flex flex-col gap-1.5">
          <span className="text-ink text-[13px] font-semibold">카테고리</span>
          <select
            name="category"
            defaultValue={filters.category ?? ''}
            className="rounded-panel border-line bg-surface text-ink focus:border-accent focus:outline-accent/40 h-10 border px-3 text-[14px] focus:outline-2"
          >
            <option value="">전체</option>
            {INQUIRY_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-ink text-[13px] font-semibold">등록일</span>
          <span className="flex items-center gap-1.5">
            <input
              type="date"
              name="from"
              aria-label="시작일"
              defaultValue={filters.from ?? ''}
              className="rounded-panel border-line bg-surface text-ink focus:border-accent focus:outline-accent/40 h-10 border px-3 text-[14px] focus:outline-2"
            />
            <span className="text-muted text-[13px]">~</span>
            <input
              type="date"
              name="to"
              aria-label="종료일"
              defaultValue={filters.to ?? ''}
              className="rounded-panel border-line bg-surface text-ink focus:border-accent focus:outline-accent/40 h-10 border px-3 text-[14px] focus:outline-2"
            />
          </span>
        </label>

        <Input
          label="검색"
          name="q"
          type="search"
          defaultValue={filters.search ?? ''}
          maxLength={SEARCH_MAX_LENGTH}
          countPlacement="label"
          placeholder="제목 · 내용 · 계정 ID"
          wrapperClassName="min-w-[220px] flex-1"
        />

        <div className="flex gap-2">
          <Button type="submit">검색</Button>
          <Button href={`${LIST_PATH}?status=${filters.tab}`} variant="secondary">
            초기화
          </Button>
        </div>
      </form>
    </div>
  )
}
