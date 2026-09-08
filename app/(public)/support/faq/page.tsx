import { PageShell } from '@/components/layout/PageShell'
import { FaqAccordion } from '@/components/support/FaqAccordion'
import { SupportCard } from '@/components/support/SupportCard'
import { getFaqGroups } from '@/lib/data/faqs'

import type { Metadata } from 'next'

const FAQ_PATH = '/support/faq'
const SUPPORT_TITLE = '고객지원'

export const metadata: Metadata = {
  title: '자주 묻는 질문',
  description: '계정, 결제, 버그 등 글자월드 이용 중 자주 묻는 질문을 모았습니다.',
}

export default async function SupportFaqPage(_props: PageProps<'/support/faq'>) {
  const groups = await getFaqGroups()

  return (
    <PageShell variant="support" title={SUPPORT_TITLE}>
      <SupportCard activeHref={FAQ_PATH}>
        <FaqAccordion groups={groups} />
      </SupportCard>
      <div className="pb-16 xl:pb-0" />
    </PageShell>
  )
}
