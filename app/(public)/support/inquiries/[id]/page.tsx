import { notFound, redirect } from 'next/navigation'

import { FlashNotice } from '@/components/board/FlashNotice'
import { PageShell } from '@/components/layout/PageShell'
import { InquiryDetailCard } from '@/components/support/InquiryDetailCard'
import { InquiryReplyThread } from '@/components/support/InquiryReplyThread'
import { InquirySubmittedDialog } from '@/components/support/InquirySubmittedDialog'
import { SupportBackLink } from '@/components/support/SupportBackLink'
import { SupportCard } from '@/components/support/SupportCard'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  INQUIRY_BACK_TO_LIST_LABEL,
  INQUIRY_CANCELLED_NOTICE,
  INQUIRY_CANCELLED_PARAM,
  INQUIRY_EDIT_LOCKED_NOTICE,
  INQUIRY_EDIT_LOCKED_PARAM,
  INQUIRY_SUBMITTED_PARAM,
  INQUIRY_UPDATED_NOTICE,
  INQUIRY_UPDATED_PARAM,
  MY_INQUIRIES_PATH,
} from '@/lib/constants/support'
import { getInquiryReplies, getMyInquiry, getSignedAttachments } from '@/lib/data/inquiries'
import { firstValue } from '@/lib/utils/list-query'

import type { Metadata } from 'next'

const SUPPORT_TITLE = '고객지원'

type SearchParams = Record<string, string | string[] | undefined>

type Notice = { param: string; message: string }

/**
 * 수정·취소 뒤 리다이렉트가 붙여 준 1회성 안내.
 *
 * 값이 아니라 존재 여부로 고르고, 문구는 서버가 정한다(주소에 문구를 실으면 링크
 * 하나로 임의 텍스트를 이 화면에 띄울 수 있다). 주소 정리는 `FlashNotice` 가 한다.
 */
function readNotice(searchParams: SearchParams): Notice | null {
  const notices: readonly Notice[] = [
    { param: INQUIRY_UPDATED_PARAM, message: INQUIRY_UPDATED_NOTICE },
    { param: INQUIRY_CANCELLED_PARAM, message: INQUIRY_CANCELLED_NOTICE },
    { param: INQUIRY_EDIT_LOCKED_PARAM, message: INQUIRY_EDIT_LOCKED_NOTICE },
  ]

  return notices.find((notice) => firstValue(searchParams[notice.param]) === '1') ?? null
}

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
  const notice = readNotice(searchParams)
  const [replies, attachments] = await Promise.all([
    getInquiryReplies(inquiry.id),
    getSignedAttachments(inquiry.attachments),
  ])

  return (
    <PageShell variant="support" title={SUPPORT_TITLE}>
      <SupportCard activeHref={MY_INQUIRIES_PATH}>
        {/* 시안 세로 리듬: 뒤로 링크 → 16 → 본문 카드 → 32 → 답변(= gap 16 + mt 16). */}
        <div className="flex flex-col gap-4">
          {/* 접수 직후에만 뜨는 완료 모달. 닫으면 주소에서 파라미터가 사라진다. */}
          {isSubmitted ? (
            <InquirySubmittedDialog
              detailPath={`${MY_INQUIRIES_PATH}/${inquiry.id}`}
              inquiryNo={inquiry.inquiryNo}
            />
          ) : null}

          {notice === null ? null : <FlashNotice param={notice.param} message={notice.message} />}

          <SupportBackLink href={MY_INQUIRIES_PATH} label={INQUIRY_BACK_TO_LIST_LABEL} />

          <InquiryDetailCard inquiry={inquiry} attachments={attachments} />

          <div className="mt-4">
            <InquiryReplyThread
              replies={replies}
              status={inquiry.status}
              cancelledAt={inquiry.cancelledAt}
            />
          </div>
        </div>
      </SupportCard>
      <div className="pb-16 xl:pb-0" />
    </PageShell>
  )
}
