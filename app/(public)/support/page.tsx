import { PageShell } from '@/components/layout/PageShell'
import { InquiryForm } from '@/components/support/InquiryForm'
import { SupportCard } from '@/components/support/SupportCard'

import type { Metadata } from 'next'

const SUPPORT_PATH = '/support'
const SUPPORT_TITLE = '고객지원'

export const metadata: Metadata = {
  title: '고객지원',
  description: '글자월드 이용 중 궁금한 점이나 불편한 점을 1:1로 문의하세요.',
}

export default function SupportPage(_props: PageProps<'/support'>) {
  return (
    <PageShell variant="support" title={SUPPORT_TITLE}>
      <SupportCard activeHref={SUPPORT_PATH}>
        <InquiryForm />
      </SupportCard>
      <div className="pb-16 xl:pb-0" />
    </PageShell>
  )
}
