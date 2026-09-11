import { InquiryPagination } from '@/components/support/InquiryPagination'
import { InquiryRow } from '@/components/support/InquiryRow'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  INQUIRY_PAGE_SIZE,
  INQUIRY_SUBMIT_LABEL,
  MY_INQUIRIES_EMPTY_DESCRIPTION,
  MY_INQUIRIES_EMPTY_TITLE,
} from '@/lib/constants/support'
import { getTotalPages } from '@/lib/utils/pagination'

import type { InquirySummary, ListResult } from '@/types/domain'

type InquiryListProps = {
  list: ListResult<InquirySummary>
}

const SUPPORT_PATH = '/support'

/**
 * 내 문의 목록.
 *
 * 시안 v2 부터 `?page=N` 은 **N 페이지만** 그린다(누적 "더보기" 폐지). 그래서
 * 전체 페이지 수는 받은 건수가 아니라 `total` 에서 센다 — 마지막 페이지가 덜 차도
 * 번호가 사라지지 않는다.
 */
export function InquiryList({ list }: InquiryListProps) {
  if (list.items.length === 0) {
    return (
      <EmptyState
        title={MY_INQUIRIES_EMPTY_TITLE}
        description={MY_INQUIRIES_EMPTY_DESCRIPTION}
        className="border-line-soft bg-page-sub"
        action={
          <Button href={SUPPORT_PATH} size="sm">
            {INQUIRY_SUBMIT_LABEL}
          </Button>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-3 lg:gap-4">
        {list.items.map((inquiry) => (
          <li key={inquiry.id}>
            <InquiryRow inquiry={inquiry} />
          </li>
        ))}
      </ul>

      <InquiryPagination
        page={list.page}
        totalPages={getTotalPages(list.total, INQUIRY_PAGE_SIZE)}
      />
    </div>
  )
}
