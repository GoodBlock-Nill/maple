import Link from 'next/link'

import { cn } from '@/lib/utils/cn'

const WINDOW_SIZE = 5

/**
 * 목록 페이지 이동.
 *
 * 상태를 갖지 않는 서버 컴포넌트다. `buildHref(page)` 가 현재 쿼리를 보존한 URL 을
 * 만들어 주므로(lib/utils/table-query.ts) 필터·정렬이 유지된 채 페이지만 바뀐다.
 */
export function Pagination({
  page,
  total,
  buildHref,
}: {
  page: number
  total: number
  buildHref: (page: number) => string
}) {
  if (total <= 1) {
    return null
  }

  const pages = windowedPages(page, total)

  return (
    <nav
      aria-label="페이지"
      className="border-line flex items-center justify-center gap-1 border-t px-4 py-3"
    >
      <PageLink href={buildHref(Math.max(1, page - 1))} disabled={page <= 1} label="이전" />
      {pages.map((candidate) => (
        <PageLink
          key={candidate}
          href={buildHref(candidate)}
          label={String(candidate)}
          isActive={candidate === page}
        />
      ))}
      <PageLink href={buildHref(Math.min(total, page + 1))} disabled={page >= total} label="다음" />
    </nav>
  )
}

function PageLink({
  href,
  label,
  isActive = false,
  disabled = false,
}: {
  href: string
  label: string
  isActive?: boolean
  disabled?: boolean
}) {
  const classes = cn(
    'inline-flex h-8 min-w-8 items-center justify-center rounded-panel px-2 text-[13px] font-semibold',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    isActive
      ? 'bg-accent text-white'
      : 'text-muted hover:bg-page hover:text-ink border border-transparent',
  )

  if (disabled) {
    return (
      <span aria-disabled="true" className={cn(classes, 'pointer-events-none opacity-40')}>
        {label}
      </span>
    )
  }

  return (
    <Link href={href} aria-current={isActive ? 'page' : undefined} className={classes}>
      {label}
    </Link>
  )
}

/** 현재 페이지를 가운데 두고 최대 5개만 보여 준다. */
function windowedPages(page: number, total: number): number[] {
  if (total <= WINDOW_SIZE) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  const half = Math.floor(WINDOW_SIZE / 2)
  let start = page - half

  if (start < 1) {
    start = 1
  }

  if (start + WINDOW_SIZE - 1 > total) {
    start = total - WINDOW_SIZE + 1
  }

  return Array.from({ length: WINDOW_SIZE }, (_, index) => start + index)
}
