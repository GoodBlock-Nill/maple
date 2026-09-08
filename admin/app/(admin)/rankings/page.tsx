import { ComingSoon } from '@/components/layout/ComingSoon'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '랭킹',
}

export default function RankingsPage() {
  return (
    <ComingSoon
      title="랭킹"
      description="랭킹 CSV 를 업로드하고 스냅샷 이력을 확인합니다."
      scope="업로드 · 스냅샷 이력"
    />
  )
}
