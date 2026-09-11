import Link from 'next/link'

import { InquiryStatusBadge } from '@/components/inquiries/InquiryStatusBadge'
import { FormBanner } from '@/components/ui/FormField'
import { Table, type Column } from '@/components/ui/Table'
import { LIST_LOAD_ERROR } from '@/lib/constants/messages'
import { formatDateTime } from '@/lib/utils/format-date'
import { formatInquiryNo } from '@/lib/utils/inquiry-no'
import { inquiryCategoryLabel, inquiryTypeLabel } from '@/lib/validation/inquiries'

import type { MemberInquirySummary } from '@/lib/data/member-inquiries'

/**
 * 회원 상세의 "1:1 문의" 탭.
 *
 * `MemberActivityPanel` 에서 떼어 낸 것은 문의 목록 컬럼(6개) · 권한 안내 ·
 * "전체 보기" 링크까지 들어오면서 그 파일이 300줄 상한에 닿기 때문이다
 * (`admin/components/inquiries/InquiryTable.tsx` 를 페이지에서 뗀 것과 같은 이유).
 */
export function MemberInquiriesTab({
  canRead,
  rows,
  hasError,
  moreHref,
}: {
  /** `inquiries:read` 없는 운영자에게는 행을 보여 주지 않는다(members:read 만으로는 부족). */
  canRead: boolean
  rows: readonly MemberInquirySummary[]
  hasError: boolean
  /** 표시한 건수보다 실제 건수가 많을 때만 온다 — `/inquiries?user=<id>`. */
  moreHref: string | null
}) {
  if (!canRead) {
    return (
      <p className="text-muted px-4 py-10 text-center text-[13px]">문의 조회 권한이 없습니다.</p>
    )
  }

  return (
    <>
      {hasError && (
        <div className="px-4 pt-3">
          <FormBanner message={LIST_LOAD_ERROR} />
        </div>
      )}
      <Table
        columns={INQUIRY_COLUMNS}
        rows={rows}
        getRowKey={(row) => row.id}
        caption="회원의 1:1 문의"
        emptyMessage="접수한 문의가 없습니다."
      />
      {moreHref !== null && (
        <div className="border-line flex justify-center border-t px-4 py-3">
          <Link
            href={moreHref}
            className="text-accent-strong focus-visible:outline-focus text-[13px] font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            전체 보기
          </Link>
        </div>
      )}
    </>
  )
}

const INQUIRY_COLUMNS: readonly Column<MemberInquirySummary>[] = [
  {
    // 문의 목록과 같은 자리·같은 표기다(운영자가 두 화면을 오가며 번호로 대조한다).
    key: 'inquiryNo',
    header: '접수번호',
    className: 'w-24',
    cell: (row) => (
      <span className="text-muted font-mono text-[13px] tabular-nums">
        {formatInquiryNo(row.inquiryNo)}
      </span>
    ),
  },
  {
    key: 'title',
    header: '제목',
    cell: (row) => (
      <Link
        href={`/inquiries/${row.id}`}
        className="text-ink hover:text-accent-strong focus-visible:outline-focus line-clamp-1 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {row.title}
      </Link>
    ),
  },
  {
    key: 'category',
    header: '카테고리 · 유형',
    className: 'w-32',
    cell: (row) => (
      <span className="text-muted">
        {inquiryCategoryLabel(row.category)} · {inquiryTypeLabel(row.type)}
      </span>
    ),
  },
  {
    key: 'status',
    header: '상태',
    className: 'w-24',
    cell: (row) => <InquiryStatusBadge status={row.status} cancelledAt={row.cancelledAt} />,
  },
  {
    key: 'replies',
    header: '답변',
    align: 'right',
    className: 'w-14',
    cell: (row) => (
      <span className={row.replyCount === 0 ? 'text-muted' : ''}>{row.replyCount}</span>
    ),
  },
  {
    key: 'created_at',
    header: '접수일',
    className: 'w-36',
    cell: (row) => <span className="text-muted">{formatDateTime(row.createdAt)}</span>,
  },
]
