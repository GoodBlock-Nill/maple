import { ComingSoon } from '@/components/layout/ComingSoon'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '1:1 문의',
}

export default function InquiriesPage() {
  return (
    <ComingSoon
      title="1:1 문의"
      description="접수된 문의를 확인하고 답변합니다."
      scope="목록 · 상세 · 답변"
    />
  )
}
