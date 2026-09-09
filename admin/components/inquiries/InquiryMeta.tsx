import Link from 'next/link'

import { InquiryEmailMeta } from '@/components/inquiries/InquiryEmailMeta'
import { MetaList, MetaRow } from '@/components/inquiries/InquiryMetaRow'
import { formatDateTime } from '@/lib/utils/format-date'
import { inquiryCategoryLabel, inquiryTypeLabel, maskAccountId } from '@/lib/validation/inquiries'

import type { InquiryDetail } from '@/lib/data/inquiries'

/**
 * 문의 메타 정보.
 *
 * 계정 ID 는 상세에서도 마스킹한다. 운영자가 앞뒤 몇 자리로 본인 확인을 하는 용도라
 * 원문이 필요하지 않고, 화면 캡처가 그대로 개인정보가 되는 것을 막는다.
 *
 * 이메일 문의는 보여 줄 항목 자체가 다르므로(계정이 없고 인증 판정이 있다) 별도
 * 컴포넌트로 넘긴다 — 한 컴포넌트 안에서 항목마다 분기하면 어느 쪽도 읽히지 않는다.
 */
export function InquiryMeta({ inquiry }: { inquiry: InquiryDetail }) {
  if (inquiry.source === 'email') {
    return <InquiryEmailMeta inquiry={inquiry} />
  }

  return (
    <MetaList>
      <MetaRow label="작성자">
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
      </MetaRow>
      <MetaRow label="계정 ID">{maskAccountId(inquiry.accountId)}</MetaRow>
      <MetaRow label="연락 이메일">{inquiry.contactEmail ?? inquiry.email ?? '-'}</MetaRow>
      <MetaRow label="카테고리 · 유형">
        {`${inquiryCategoryLabel(inquiry.category)} · ${inquiryTypeLabel(inquiry.type)}`}
      </MetaRow>
      <MetaRow label="접수일">{formatDateTime(inquiry.createdAt)}</MetaRow>
      <MetaRow label="최근 업데이트">{formatDateTime(inquiry.updatedAt)}</MetaRow>
      {inquiry.answeredAt !== null && (
        <MetaRow label="첫 답변">{formatDateTime(inquiry.answeredAt)}</MetaRow>
      )}
      {inquiry.cancelledAt !== null && (
        <MetaRow label="접수 취소">{formatDateTime(inquiry.cancelledAt)}</MetaRow>
      )}
    </MetaList>
  )
}
