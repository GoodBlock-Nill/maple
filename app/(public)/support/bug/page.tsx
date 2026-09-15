import { InquiryKindPage } from '@/components/support/InquiryKindPage'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '버그 신고하기',
  description: '글자월드에서 겪은 오류·비정상 동작을 제보해 주세요. 운영자가 확인 후 답변합니다.',
}

/* 본문은 1:1 문의와 같은 컴포넌트다 — 창구(kind)만 다르다. */
export default async function SupportBugPage(_props: PageProps<'/support/bug'>) {
  return <InquiryKindPage kind="bug" />
}
