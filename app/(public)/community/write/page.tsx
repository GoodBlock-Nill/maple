import { redirect } from 'next/navigation'

import { BackToListLink } from '@/components/board/BackToListLink'
import { ListSheet } from '@/components/board/ListSheet'
import { PostForm } from '@/components/board/PostForm'
import { PageShell } from '@/components/layout/PageShell'
import { getCurrentUser } from '@/lib/auth/current-user'

import type { Metadata } from 'next'

const COMMUNITY_PATH = '/community'
const WRITE_PATH = '/community/write'

export const metadata: Metadata = {
  title: '글쓰기',
  description: '자유게시판에 새 글을 작성합니다.',
  robots: { index: false, follow: false },
}

export default async function CommunityWritePage(_props: PageProps<'/community/write'>) {
  // 프록시의 검사는 낙관적이다(세션 쿠키만 본다). 실제 게이트는 여기서 한 번 더 건다.
  const user = await getCurrentUser()

  if (user === null) {
    redirect(`/login?next=${encodeURIComponent(WRITE_PATH)}`)
  }

  return (
    <PageShell variant="community" title="글쓰기">
      <ListSheet className="mt-6">
        <PostForm />
      </ListSheet>

      <BackToListLink href={COMMUNITY_PATH} />
    </PageShell>
  )
}
