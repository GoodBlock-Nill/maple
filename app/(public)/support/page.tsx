import { PageShell } from '@/components/layout/PageShell'
import { InquiryForm } from '@/components/support/InquiryForm'
import { SupportCard } from '@/components/support/SupportCard'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getInquiryCategories } from '@/lib/data/inquiry-categories'

import type { Metadata } from 'next'

const SUPPORT_PATH = '/support'
const SUPPORT_TITLE = '고객지원'

export const metadata: Metadata = {
  title: '고객지원',
  description: '글자월드 이용 중 궁금한 점이나 불편한 점을 1:1로 문의하세요.',
}

/* 폼이 세션에 따라 달라지므로(제출 잠금 · "내 문의 내역" 링크) 정적으로 굳히지 않는다. */
export default async function SupportPage(_props: PageProps<'/support'>) {
  /* 카테고리는 누가 보든 같은 공개 문구라 캐시에서 읽는다(태그 `inquiry-categories`).
     로그인 판정과 서로 기다릴 이유가 없어 함께 던진다. */
  const [user, categories] = await Promise.all([getCurrentUser(), getInquiryCategories()])

  return (
    <PageShell variant="support" title={SUPPORT_TITLE}>
      <SupportCard activeHref={SUPPORT_PATH}>
        <InquiryForm isAuthenticated={user !== null} categories={categories} />
      </SupportCard>
      <div className="pb-16 xl:pb-0" />
    </PageShell>
  )
}
