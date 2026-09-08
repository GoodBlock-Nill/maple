import { LoadMoreButton } from '@/components/board/LoadMoreButton'
import { InquiryRow } from '@/components/support/InquiryRow'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  INQUIRY_SUBMIT_LABEL,
  MY_INQUIRIES_EMPTY_DESCRIPTION,
  MY_INQUIRIES_EMPTY_TITLE,
  MY_INQUIRIES_PATH,
} from '@/lib/constants/support'
import { buildHref } from '@/lib/utils/list-query'

import type { InquirySummary, ListResult } from '@/types/domain'

type InquiryListProps = {
  list: ListResult<InquirySummary>
}

const SUPPORT_PATH = '/support'

/**
 * 내 문의 목록.
 *
 * "더보기"는 누적 로드(`?page=N` 이 1~N 페이지를 한 번에 그린다)라, 링크는 항상
 * 다음 페이지 번호만 올린다. 스크롤 유지는 `LoadMoreButton` 이 처리한다.
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
    <div className="flex flex-col">
      <ul className="flex flex-col gap-3">
        {list.items.map((inquiry) => (
          <li key={inquiry.id}>
            <InquiryRow inquiry={inquiry} />
          </li>
        ))}
      </ul>

      <LoadMoreButton
        href={buildHref(MY_INQUIRIES_PATH, { page: list.page + 1 })}
        shown={list.shown}
        total={list.total}
      />
    </div>
  )
}
