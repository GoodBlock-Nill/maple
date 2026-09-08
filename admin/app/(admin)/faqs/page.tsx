import { ComingSoon } from '@/components/layout/ComingSoon'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAQ',
}

export default function FaqsPage() {
  return (
    <ComingSoon
      title="FAQ"
      description="자주 묻는 질문을 등록하고 순서를 조정합니다."
      scope="CRUD · 정렬"
    />
  )
}
