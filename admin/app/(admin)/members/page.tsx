import { ComingSoon } from '@/components/layout/ComingSoon'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '회원',
}

export default function MembersPage() {
  return (
    <ComingSoon
      title="회원"
      description="회원을 검색하고 정지·해제, 권한, 닉네임을 관리합니다."
      scope="목록 · 상세 · 제재"
    />
  )
}
