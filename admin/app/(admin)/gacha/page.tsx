import { ComingSoon } from '@/components/layout/ComingSoon'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '가이드',
}

export default function GachaPage() {
  return (
    <ComingSoon
      title="가이드"
      description="확률형 아이템 정보를 관리하고 CSV 로 주고받습니다."
      scope="CRUD · CSV 가져오기/내보내기"
    />
  )
}
