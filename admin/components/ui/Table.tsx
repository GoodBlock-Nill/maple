import Link from 'next/link'

import { cn } from '@/lib/utils/cn'

import type { SortState } from '@/lib/utils/table-query'
import type { ReactNode } from 'react'

export type ColumnAlign = 'left' | 'center' | 'right'

export type Column<TRow> = {
  /** React key 이자 컬럼 식별자. */
  key: string
  header: ReactNode
  cell: (row: TRow) => ReactNode
  /** 값이 있으면 헤더가 정렬 링크가 된다(`?sort=<sortKey>:asc|desc`). */
  sortKey?: string
  align?: ColumnAlign
  /** `w-32` 처럼 리터럴 클래스만 넘긴다 — Tailwind 는 소스를 정적으로 훑는다. */
  className?: string
}

type TableProps<TRow> = {
  columns: readonly Column<TRow>[]
  rows: readonly TRow[]
  getRowKey: (row: TRow) => string
  /** 현재 정렬 상태. 헤더의 방향 표시에 쓴다. */
  sort?: SortState
  /** 정렬 링크 생성기. 없으면 헤더는 정적 텍스트로 남는다. */
  buildSortHref?: (sortKey: string) => string
  emptyMessage?: string
  /** 스트리밍(Suspense) 폴백에서 쓰는 골격. */
  isLoading?: boolean
  skeletonRows?: number
  /** 스크린 리더용 표 설명. 화면에는 보이지 않는다. */
  caption?: string
}

const ALIGN_CLASS: Record<ColumnAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

/**
 * 헤드리스 목록 표.
 *
 * 상태를 갖지 않는 **서버 컴포넌트**다. 정렬은 헤더의 `<Link>` 가 쿼리스트링을
 * 다시 쓰고, 페이지 이동은 `<Pagination>` 이 맡는다. 자바스크립트가 없어도
 * 목록이 완전히 동작하고, 뒤로가기·새로고침·링크 공유가 모두 같은 화면을 낸다.
 *
 * `cell` 이 임의의 JSX 를 반환하므로 클라이언트 컴포넌트로 만들 수 없다 —
 * 함수는 서버→클라이언트 경계를 넘지 못한다.
 */
export function Table<TRow>({
  columns,
  rows,
  getRowKey,
  sort,
  buildSortHref,
  emptyMessage = '표시할 항목이 없습니다.',
  isLoading = false,
  skeletonRows = 5,
  caption,
}: TableProps<TRow>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-[13px]">
        {caption !== undefined && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-line bg-page/60 border-b">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                aria-sort={ariaSort(column, sort)}
                className={cn(
                  'text-muted px-4 py-2.5 text-[12px] font-semibold',
                  ALIGN_CLASS[column.align ?? 'left'],
                  column.className,
                )}
              >
                <HeaderCell column={column} sort={sort} buildSortHref={buildSortHref} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <SkeletonRows columns={columns} count={skeletonRows} />
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-muted px-4 py-12 text-center text-[13px]">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)} className="border-line hover:bg-page/70 border-b last:border-b-0">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'text-ink px-4 py-3 align-middle',
                      ALIGN_CLASS[column.align ?? 'left'],
                      column.className,
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function ariaSort<TRow>(
  column: Column<TRow>,
  sort: SortState | undefined,
): 'ascending' | 'descending' | 'none' | undefined {
  if (column.sortKey === undefined) {
    return undefined
  }

  if (sort === undefined || sort.key !== column.sortKey) {
    return 'none'
  }

  return sort.direction === 'asc' ? 'ascending' : 'descending'
}

function HeaderCell<TRow>({
  column,
  sort,
  buildSortHref,
}: {
  column: Column<TRow>
  sort: SortState | undefined
  buildSortHref: ((sortKey: string) => string) | undefined
}) {
  if (column.sortKey === undefined || buildSortHref === undefined) {
    return <>{column.header}</>
  }

  const isActive = sort?.key === column.sortKey
  const arrow = !isActive ? '↕' : sort?.direction === 'asc' ? '↑' : '↓'

  return (
    <Link
      href={buildSortHref(column.sortKey)}
      className={cn(
        'focus-visible:outline-focus inline-flex items-center gap-1 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2',
        isActive ? 'text-accent-strong' : 'hover:text-ink',
      )}
    >
      {column.header}
      <span aria-hidden="true" className="text-[11px]">
        {arrow}
      </span>
    </Link>
  )
}

function SkeletonRows<TRow>({
  columns,
  count,
}: {
  columns: readonly Column<TRow>[]
  count: number
}) {
  return (
    <>
      {Array.from({ length: count }, (_, rowIndex) => (
        <tr key={rowIndex} className="border-line border-b last:border-b-0">
          {columns.map((column) => (
            <td key={column.key} className="px-4 py-3">
              <span className="bg-line/70 block h-3.5 w-full animate-pulse rounded-sm" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
