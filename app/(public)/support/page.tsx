import { InquiryKindPage } from '@/components/support/InquiryKindPage'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '고객지원',
  description: '글자월드 이용 중 궁금한 점이나 불편한 점을 1:1로 문의하세요.',
}

/* 폼이 세션에 따라 달라지므로(제출 잠금 · "내 문의 내역" 링크) 정적으로 굳히지 않는다. */
export default async function SupportPage(_props: PageProps<'/support'>) {
  return <InquiryKindPage kind="inquiry" />
}
