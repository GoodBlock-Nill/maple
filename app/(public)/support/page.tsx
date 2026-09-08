import { PageShell } from '@/components/layout/PageShell'
import { InquiryForm } from '@/components/support/InquiryForm'
import { SupportCard } from '@/components/support/SupportCard'
import { getCurrentUser } from '@/lib/auth/current-user'

import type { Metadata } from 'next'

const SUPPORT_PATH = '/support'
const SUPPORT_TITLE = '고객지원'

export const metadata: Metadata = {
  title: '고객지원',
  description: '글자월드 이용 중 궁금한 점이나 불편한 점을 1:1로 문의하세요.',
}

/* 폼이 세션에 따라 달라지므로(제출 잠금 · "내 문의 내역" 링크) 정적으로 굳히지 않는다. */
export default async function SupportPage(_props: PageProps<'/support'>) {
  const user = await getCurrentUser()

  return (
    <PageShell variant="support" title={SUPPORT_TITLE}>
      <SupportCard activeHref={SUPPORT_PATH}>
        <InquiryForm isAuthenticated={user !== null} />
      </SupportCard>
      <div className="pb-16 xl:pb-0" />
    </PageShell>
  )
}
