import Link from 'next/link'

import { ChevronLeftIcon, ChevronRightIcon } from '@/components/support/support-icons'
import { MY_INQUIRIES_PATH } from '@/lib/constants/support'
import { cn } from '@/lib/utils/cn'
import { buildHref } from '@/lib/utils/list-query'
import { getPageRange } from '@/lib/utils/pagination'

import type { ReactNode } from 'react'

/** 시안 v2: 현재 페이지를 가운데 두고 최대 5개까지 번호를 보여 준다. */
const PAGE_WINDOW_SIZE = 5

const ARROW_CLASS =
  'inline-flex size-9 items-center justify-center rounded-[6px] text-[#727272] transition-colors ' +
  'hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

const NUMBER_CLASS =
  'inline-flex h-[38px] min-w-8 items-center justify-center rounded-[6px] px-2 ' +
  'text-[16px] leading-[22px] font-medium transition-colors focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-focus'

type InquiryPaginationProps = {
  page: number
  totalPages: number
}

/**
 * 내 문의 내역의 번호 페이지네이션.
 *
 * `?page=N` 은 N 페이지 한 장만 그린다(누적 "더보기"를 대체). 페이지가 하나뿐이면
 * 아무것도 그리지 않는다 — 누를 곳이 없는 컨트롤은 자리만 차지한다.
 *
 * 끝 페이지의 화살표는 링크 대신 흐린 아이콘으로 남긴다. 지워 버리면 번호 줄의
 * 좌우 균형이 페이지마다 달라져 눈이 매번 다시 자리를 찾는다.
 */
export function InquiryPagination({ page, totalPages }: InquiryPaginationProps) {
  if (totalPages <= 1) {
    return null
  }

  const pages = getPageRange(page, totalPages, PAGE_WINDOW_SIZE)

  return (
    <nav aria-label="내 문의 내역 페이지" className="flex items-center justify-center gap-4">
      <PageArrow page={page - 1} isDisabled={page <= 1} label="이전 페이지">
        <ChevronLeftIcon className="size-6" />
      </PageArrow>

      <ul className="flex items-center gap-2">
        {pages.map((number) => (
          <li key={number}>
            {number === page ? (
              <span aria-current="page" className={cn(NUMBER_CLASS, 'bg-ink text-white')}>
                {number}
              </span>
            ) : (
              <Link
                href={buildHref(MY_INQUIRIES_PATH, { page: number })}
                aria-label={`${number} 페이지`}
                className={cn(NUMBER_CLASS, 'text-ink hover:bg-page-sub')}
              >
                {number}
              </Link>
            )}
          </li>
        ))}
      </ul>

      <PageArrow page={page + 1} isDisabled={page >= totalPages} label="다음 페이지">
        <ChevronRightIcon className="size-6" />
      </PageArrow>
    </nav>
  )
}

type PageArrowProps = {
  page: number
  isDisabled: boolean
  label: string
  children: ReactNode
}

function PageArrow({ page, isDisabled, label, children }: PageArrowProps) {
  if (isDisabled) {
    return (
      <span aria-hidden className={cn(ARROW_CLASS, 'opacity-40')}>
        {children}
      </span>
    )
  }

  return (
    <Link href={buildHref(MY_INQUIRIES_PATH, { page })} aria-label={label} className={ARROW_CLASS}>
      {children}
    </Link>
  )
}
