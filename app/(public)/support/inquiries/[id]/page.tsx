import { notFound, redirect } from 'next/navigation'

import { BackToListLink } from '@/components/board/BackToListLink'
import { PageShell } from '@/components/layout/PageShell'
import { InquiryDetailCard } from '@/components/support/InquiryDetailCard'
import { InquiryReplyThread } from '@/components/support/InquiryReplyThread'
import { InquirySubmittedDialog } from '@/components/support/InquirySubmittedDialog'
import { SupportCard } from '@/components/support/SupportCard'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  INQUIRY_SUBMITTED_PARAM,
  MY_INQUIRIES_DESCRIPTION,
  MY_INQUIRIES_HEADING,
  MY_INQUIRIES_PATH,
} from '@/lib/constants/support'
import { getInquiryReplies, getMyInquiry, getSignedAttachments } from '@/lib/data/inquiries'
import { firstValue } from '@/lib/utils/list-query'

import type { Metadata } from 'next'

const SUPPORT_TITLE = '고객지원'

/** 제목에 개인정보가 섞일 수 있어 메타에는 싣지 않고 색인도 막는다. */
export const metadata: Metadata = {
  title: '내 문의 내역',
  robots: { index: false, follow: false },
}

/**
 * 문의 상세.
 *
 * 소유자 판정은 데이터 계층이 `user_id` 조건으로 하고(그 위에 RLS 가 한 번 더 있다),
 * 결과가 없으면 404 로 끝낸다 — "권한 없음"을 구분해 알려 주면 남의 문의 id 가
 * 존재하는지 여부가 새어 나간다.
 */
export default async function InquiryDetailPage(props: PageProps<'/support/inquiries/[id]'>) {
  const { id } = await props.params
  const user = await getCurrentUser()

  if (user === null) {
    redirect(`/login?next=${encodeURIComponent(`${MY_INQUIRIES_PATH}/${id}`)}`)
  }

  const inquiry = await getMyInquiry(id, user.id)

  if (inquiry === null) {
    notFound()
  }

  const searchParams = await props.searchParams
  const isSubmitted = firstValue(searchParams[INQUIRY_SUBMITTED_PARAM]) === '1'
  const [replies, attachments] = await Promise.all([
    getInquiryReplies(inquiry.id),
    getSignedAttachments(inquiry.attachments),
  ])

  return (
    <PageShell variant="support" title={SUPPORT_TITLE}>
      <SupportCard
        activeHref={MY_INQUIRIES_PATH}
        heading={MY_INQUIRIES_HEADING}
        description={MY_INQUIRIES_DESCRIPTION}
      >
        <div className="flex flex-col gap-6">
          {/* 접수 직후에만 뜨는 완료 모달. 닫으면 주소에서 파라미터가 사라진다. */}
          {isSubmitted ? (
            <InquirySubmittedDialog detailPath={`${MY_INQUIRIES_PATH}/${inquiry.id}`} />
          ) : null}

          <InquiryDetailCard inquiry={inquiry} attachments={attachments} />

          <InquiryReplyThread replies={replies} />

          <BackToListLink href={MY_INQUIRIES_PATH} />
        </div>
      </SupportCard>
      <div className="pb-16 xl:pb-0" />
    </PageShell>
  )
}
