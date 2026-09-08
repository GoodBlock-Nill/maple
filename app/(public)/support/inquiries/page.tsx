import { redirect } from 'next/navigation'

import { PageShell } from '@/components/layout/PageShell'
import { InquiryList } from '@/components/support/InquiryList'
import { SupportCard } from '@/components/support/SupportCard'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  MY_INQUIRIES_DESCRIPTION,
  MY_INQUIRIES_HEADING,
  MY_INQUIRIES_PATH,
} from '@/lib/constants/support'
import { getMyInquiries } from '@/lib/data/inquiries'
import { parsePage } from '@/lib/utils/list-query'

import type { Metadata } from 'next'

const SUPPORT_TITLE = '고객지원'

/** 본인만 보는 화면이라 검색 노출을 막는다. */
export const metadata: Metadata = {
  title: '내 문의 내역',
  description: '접수한 1:1 문의와 운영자 답변을 확인합니다.',
  robots: { index: false, follow: false },
}

/**
 * 내 문의 내역.
 *
 * 비로그인 접근은 프록시가 아니라 이 페이지가 막는다. `/support` 는 읽기가 열려
 * 있어야 하는 경로(문의 폼)이므로 접두사 단위로 잠글 수 없고, 잠금이 필요한 것은
 * 이 하위 트리뿐이다.
 */
export default async function MyInquiriesPage(props: PageProps<'/support/inquiries'>) {
  const user = await getCurrentUser()

  if (user === null) {
    redirect(`/login?next=${encodeURIComponent(MY_INQUIRIES_PATH)}`)
  }

  const searchParams = await props.searchParams
  const page = parsePage(searchParams.page)
  const list = await getMyInquiries(user.id, page)

  return (
    <PageShell variant="support" title={SUPPORT_TITLE}>
      <SupportCard
        activeHref={MY_INQUIRIES_PATH}
        heading={MY_INQUIRIES_HEADING}
        description={MY_INQUIRIES_DESCRIPTION}
      >
        <InquiryList list={list} />
      </SupportCard>
      <div className="pb-16 xl:pb-0" />
    </PageShell>
  )
}
