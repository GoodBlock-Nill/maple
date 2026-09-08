import { notFound, redirect } from 'next/navigation'

import { BackToListLink } from '@/components/board/BackToListLink'
import { PageShell } from '@/components/layout/PageShell'
import { InquiryForm } from '@/components/support/InquiryForm'
import { SupportCard } from '@/components/support/SupportCard'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  INQUIRY_EDIT_DESCRIPTION,
  INQUIRY_EDIT_HEADING,
  INQUIRY_EDIT_LOCKED_PARAM,
  MY_INQUIRIES_PATH,
} from '@/lib/constants/support'
import { getMyInquiry } from '@/lib/data/inquiries'
import { canEditInquiry } from '@/lib/utils/inquiry-permissions'

import type { Metadata } from 'next'

const SUPPORT_TITLE = '고객지원'

/** 본인만 보는 화면이라 검색 노출을 막는다. */
export const metadata: Metadata = {
  title: '문의 수정',
  robots: { index: false, follow: false },
}

/**
 * 접수 대기 중인 문의의 수정 화면.
 *
 * 비로그인은 로그인으로, 남의 문의는 404 로(존재 여부를 흘리지 않는다), 이미
 * 처리가 시작됐거나 취소한 문의는 상세로 돌려보내며 이유를 1회성 안내로 남긴다 —
 * 주소를 직접 친 사용자가 빈 화면 앞에서 이유를 모르는 상황을 만들지 않는다.
 * 최종 권한은 `updateInquiry` 액션과 `guard_inquiry_owner_update()` 가 강제한다.
 */
export default async function InquiryEditPage(props: PageProps<'/support/inquiries/[id]/edit'>) {
  const { id } = await props.params
  const user = await getCurrentUser()

  if (user === null) {
    redirect(`/login?next=${encodeURIComponent(`${MY_INQUIRIES_PATH}/${id}/edit`)}`)
  }

  const inquiry = await getMyInquiry(id, user.id)

  if (inquiry === null) {
    notFound()
  }

  const detailPath = `${MY_INQUIRIES_PATH}/${inquiry.id}`

  if (!canEditInquiry(inquiry)) {
    redirect(`${detailPath}?${INQUIRY_EDIT_LOCKED_PARAM}=1`)
  }

  return (
    <PageShell variant="support" title={SUPPORT_TITLE}>
      <SupportCard
        activeHref={MY_INQUIRIES_PATH}
        heading={INQUIRY_EDIT_HEADING}
        description={INQUIRY_EDIT_DESCRIPTION}
      >
        <InquiryForm
          isAuthenticated
          inquiryId={inquiry.id}
          defaultValues={{
            accountId: inquiry.accountId ?? '',
            category: inquiry.category,
            type: inquiry.type,
            title: inquiry.title,
            content: inquiry.content,
          }}
          attachments={inquiry.attachments}
        />
      </SupportCard>

      <BackToListLink href={detailPath} label="문의로 돌아가기" />
    </PageShell>
  )
}
