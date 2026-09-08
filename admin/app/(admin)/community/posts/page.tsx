import { ComingSoon } from '@/components/layout/ComingSoon'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '커뮤니티 게시글',
}

export default function CommunityPostsPage() {
  return (
    <ComingSoon
      title="커뮤니티 게시글"
      description="사용자 게시글을 검색하고 숨김·복구·삭제를 처리합니다."
      scope="목록 · 검색 · 숨김/복구"
    />
  )
}
