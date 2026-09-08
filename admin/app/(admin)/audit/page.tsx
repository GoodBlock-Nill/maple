import { ComingSoon } from '@/components/layout/ComingSoon'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '감사 로그',
}

export default function AuditPage() {
  return (
    <ComingSoon
      title="감사 로그"
      description="관리자 행위 이력을 조회합니다."
      scope="조회 · 필터"
    />
  )
}
