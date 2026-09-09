import Link from 'next/link'

import { Button, Input } from '@/components/ui'
import { SEARCH_MAX_LENGTH } from '@/lib/constants/field-limits'
import { cn } from '@/lib/utils/cn'
import { buildHref, firstValue, type QueryParams } from '@/lib/utils/table-query'
import {
  INQUIRY_CATEGORIES,
  INQUIRY_SOURCES,
  INQUIRY_SOURCE_LABELS,
  INQUIRY_STATUS_TABS,
} from '@/lib/validation/inquiries'

import type { InquiryTabCounts } from '@/lib/data/inquiries'
import type { InquiryFilters as Filters } from '@/lib/validation/inquiries'

const LIST_PATH = '/inquiries'

/* select 는 공용 프리미티브(`Select`)가 아니라 여기서 직접 그린다 — 이 폼은
   자바스크립트 없이 동작해야 하는 GET 폼이라 이름(name)이 그대로 쿼리 키가 된다. */
const CONTROL_CLASS =
  'rounded-panel border-line bg-surface text-ink focus:border-accent focus:outline-accent/40 h-10 border px-3 text-[14px] focus:outline-2'

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
  const isEmail = filters.source === 'email'
  /* 이메일 문의는 사용자가 접수를 취소할 수단이 없다 — 언제나 0 인 탭을 두면
     운영자가 "취소가 안 잡히나" 하고 의심하게 된다. */
  const tabs = isEmail
    ? INQUIRY_STATUS_TABS.filter((tab) => tab.value !== 'cancelled')
    : INQUIRY_STATUS_TABS
  const resetHref =
    filters.source === null
      ? `${LIST_PATH}?status=${filters.tab}`
      : `${LIST_PATH}?status=${filters.tab}&source=${filters.source}`

  return (
    <div className="mb-4 flex flex-col gap-3">
      <nav aria-label="상태" className="flex flex-wrap gap-1.5">
        {tabs.map((tab) => {
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
          <span className="text-ink text-[13px] font-semibold">출처</span>
          <select name="source" defaultValue={filters.source ?? ''} className={CONTROL_CLASS}>
            <option value="">전체</option>
            {INQUIRY_SOURCES.map((source) => (
              <option key={source} value={source}>
                {INQUIRY_SOURCE_LABELS[source]}
              </option>
            ))}
          </select>
        </label>

        {/* 이메일 문의의 카테고리는 수신 함수가 'email' 로 고정한다. 고를 것이 없다. */}
        {!isEmail && (
          <label className="flex flex-col gap-1.5">
            <span className="text-ink text-[13px] font-semibold">카테고리</span>
            <select name="category" defaultValue={filters.category ?? ''} className={CONTROL_CLASS}>
              <option value="">전체</option>
              {INQUIRY_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-ink text-[13px] font-semibold">등록일</span>
          <span className="flex items-center gap-1.5">
            <input
              type="date"
              name="from"
              aria-label="시작일"
              defaultValue={filters.from ?? ''}
              className={CONTROL_CLASS}
            />
            <span className="text-muted text-[13px]">~</span>
            <input
              type="date"
              name="to"
              aria-label="종료일"
              defaultValue={filters.to ?? ''}
              className={CONTROL_CLASS}
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
          placeholder="제목 · 내용 · 계정 ID · 발신자 주소"
          wrapperClassName="min-w-[220px] flex-1"
        />

        <div className="flex gap-2">
          <Button type="submit">검색</Button>
          <Button href={resetHref} variant="secondary">
            초기화
          </Button>
        </div>
      </form>
    </div>
  )
}
