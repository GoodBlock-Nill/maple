import { InquiryKindPage } from '@/components/support/InquiryKindPage'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '불법이용제보',
  description:
    '불법 프로그램·버그 악용·현금 거래·비매너 이용을 제보해 주세요. 운영자가 확인 후 조치합니다.',
}

/* 본문은 1:1 문의와 같은 컴포넌트다 — 창구(kind)만 다르다. */
export default async function SupportReportPage(_props: PageProps<'/support/report'>) {
  return <InquiryKindPage kind="report" />
}
