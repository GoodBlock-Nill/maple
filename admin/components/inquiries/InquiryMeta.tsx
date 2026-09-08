import Link from 'next/link'

import { formatDateTime } from '@/lib/utils/format-date'
import { maskAccountId } from '@/lib/validation/inquiries'

import type { InquiryDetail } from '@/lib/data/inquiries'
import type { ReactNode } from 'react'

/**
 * 문의 메타 정보.
 *
 * 계정 ID 는 상세에서도 마스킹한다. 운영자가 앞뒤 몇 자리로 본인 확인을 하는 용도라
 * 원문이 필요하지 않고, 화면 캡처가 그대로 개인정보가 되는 것을 막는다.
 */
export function InquiryMeta({ inquiry }: { inquiry: InquiryDetail }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      <Row label="작성자">
        {inquiry.userId === null ? (
          <span className="text-muted">{inquiry.nickname}</span>
        ) : (
          /* 회원 상세는 '회원' 모듈이 소유한다(docs/admin/PLAN.md §3). */
          <Link
            href={`/members/${inquiry.userId}`}
            className="text-accent-strong focus-visible:outline-focus font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {inquiry.nickname}
          </Link>
        )}
      </Row>
      <Row label="계정 ID">{maskAccountId(inquiry.accountId)}</Row>
      <Row label="연락 이메일">{inquiry.contactEmail ?? inquiry.email ?? '-'}</Row>
      <Row label="카테고리 · 유형">{`${inquiry.category} · ${inquiry.type}`}</Row>
      <Row label="접수일">{formatDateTime(inquiry.createdAt)}</Row>
      <Row label="최근 업데이트">{formatDateTime(inquiry.updatedAt)}</Row>
      {inquiry.answeredAt !== null && (
        <Row label="첫 답변">{formatDateTime(inquiry.answeredAt)}</Row>
      )}
      {inquiry.cancelledAt !== null && (
        <Row label="접수 취소">{formatDateTime(inquiry.cancelledAt)}</Row>
      )}
    </dl>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted text-[12px] font-semibold">{label}</dt>
      <dd className="text-ink text-[14px]">{children}</dd>
    </div>
  )
}
