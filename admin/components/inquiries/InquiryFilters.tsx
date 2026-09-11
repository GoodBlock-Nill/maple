import Link from 'next/link'

import { InquiryAssigneeFilter } from '@/components/inquiries/InquiryAssigneeFilter'
import { CONTROL_CLASS } from '@/components/inquiries/inquiry-filter-controls'
import { Button, Input } from '@/components/ui'
import { SEARCH_MAX_LENGTH } from '@/lib/constants/field-limits'
import { cn } from '@/lib/utils/cn'
import { buildHref, firstValue, type QueryParams } from '@/lib/utils/table-query'
import { INQUIRY_STATUS_TABS } from '@/lib/validation/inquiries'

import type { AdminListItem } from '@/lib/data/admins'
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
  categories,
  types,
  admins,
}: {
  params: QueryParams
  filters: Filters
  counts: InquiryTabCounts
  /** 담당자 필터의 선택지(= 관리자 전원). */
  admins: readonly AdminListItem[]
  /** DB 의 카테고리(비활성 포함) + 데이터에만 남은 옛 라벨. `lib/data/inquiry-categories.ts` */
  categories: readonly string[]
  /** 고른 카테고리의 세부 유형(카테고리 미선택이면 전체) + 데이터에만 남은 옛 유형. */
  types: readonly string[]
}) {
  const sort = firstValue(params.sort)
  const isEmail = filters.source === 'email'
  /* 이메일 문의는 사용자가 접수를 취소할 수단이 없다 — 언제나 0 인 탭을 두면
     운영자가 "취소가 안 잡히나" 하고 의심하게 된다. */
  const tabs = isEmail
    ? INQUIRY_STATUS_TABS.filter((tab) => tab.value !== 'cancelled')
    : INQUIRY_STATUS_TABS
  /* 회원 상세에서 넘어온 `user` 스코프는 초기화에서도 유지한다 — "검색 조건을
     지운다"는 뜻이지 "이 회원 밖으로 나간다"는 뜻이 아니다. */
  const resetHref = buildHref(
    LIST_PATH,
    {},
    { status: filters.tab, source: filters.source, user: filters.userId },
  )

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
        {/* 출처는 **고르는 값이 아니라 이 화면이 어느 메뉴인지**다(사이드바의 두 프리셋).
            선택 상자는 없애되, 조건을 바꿀 때 프리셋을 잃지 않도록 숨은 값으로 나른다. */}
        {filters.source !== null && <input type="hidden" name="source" value={filters.source} />}
        {sort !== null && <input type="hidden" name="sort" value={sort} />}
        {filters.userId !== null && <input type="hidden" name="user" value={filters.userId} />}

        <InquiryAssigneeFilter value={filters.assignee} admins={admins} />

        {/* 이메일 문의의 카테고리는 수신 함수가 'email' 로 고정한다. 고를 것이 없다. */}
        {!isEmail && (
          <label className="flex flex-col gap-1.5">
            <span className="text-ink text-[13px] font-semibold">카테고리</span>
            <select name="category" defaultValue={filters.category ?? ''} className={CONTROL_CLASS}>
              <option value="">전체</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* 유형 옵션은 카테고리를 고른 뒤 '검색'을 누르면 그 카테고리의 것만 남는다.
            이메일 문의의 유형('일반')은 수신 함수가 고정하므로 고를 것이 없다. */}
        {!isEmail && types.length > 0 && (
          <label className="flex flex-col gap-1.5">
            <span className="text-ink text-[13px] font-semibold">유형</span>
            <select name="type" defaultValue={filters.type ?? ''} className={CONTROL_CLASS}>
              <option value="">전체</option>
              {types.map((type) => (
                <option key={type} value={type}>
                  {type}
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
