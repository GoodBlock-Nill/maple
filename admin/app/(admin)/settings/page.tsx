import { ComingSoon } from '@/components/layout/ComingSoon'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '사이트 설정',
}

export default function SettingsPage() {
  return (
    <ComingSoon
      title="사이트 설정"
      description="월드 ID·SNS·크리에이터 소개·히어로 배너를 관리합니다."
      scope="설정 · 이미지 업로드"
    />
  )
}
