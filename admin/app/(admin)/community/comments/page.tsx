import { ComingSoon } from '@/components/layout/ComingSoon'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '커뮤니티 댓글',
}

export default function CommunityCommentsPage() {
  return (
    <ComingSoon
      title="커뮤니티 댓글"
      description="댓글을 검색하고 숨김·복구·삭제를 처리합니다."
      scope="목록 · 검색 · 숨김/복구"
    />
  )
}
