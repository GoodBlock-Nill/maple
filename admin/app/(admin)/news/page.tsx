import { ComingSoon } from '@/components/layout/ComingSoon'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '뉴스',
}

export default function NewsPage() {
  return (
    <ComingSoon
      title="뉴스"
      description="뉴스 게시글을 작성·수정하고 발행 상태를 관리합니다."
      scope="목록 · 작성 · 수정 · 삭제"
    />
  )
}
