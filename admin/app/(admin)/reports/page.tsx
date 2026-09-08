import { ComingSoon } from '@/components/layout/ComingSoon'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '신고',
}

export default function ReportsPage() {
  return (
    <ComingSoon
      title="신고"
      description="접수된 신고를 검토하고 숨김·제재로 연계합니다."
      scope="큐 · 미리보기 · 처리/기각"
    />
  )
}
