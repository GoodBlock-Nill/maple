import { notFound, redirect } from 'next/navigation'

import { BackToListLink } from '@/components/board/BackToListLink'
import { ListSheet } from '@/components/board/ListSheet'
import { PostForm } from '@/components/board/PostForm'
import { PageShell } from '@/components/layout/PageShell'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getPostById } from '@/lib/data/community'
import { isAuthor } from '@/lib/utils/authorship'

import type { Metadata } from 'next'

const COMMUNITY_PATH = '/community'

export const metadata: Metadata = {
  title: '글 수정',
  description: '자유게시판에 올린 글을 수정합니다.',
  robots: { index: false, follow: false },
}

/**
 * 작성자 본인만 들어오는 수정 화면.
 *
 * 프록시의 세션 검사는 낙관적이라 여기서 다시 막는다. 비로그인은 로그인으로,
 * 남의 글이면 상세로 돌려보낸다(404 로 감추면 "글이 사라졌다"는 오해가 생긴다).
 * 최종 권한은 `updatePost` 액션과 `posts_update_own` 정책이 강제한다.
 */
export default async function CommunityEditPage(props: PageProps<'/community/[id]/edit'>) {
  const { id } = await props.params
  const [post, user] = await Promise.all([getPostById(id), getCurrentUser()])

  if (post === null) {
    notFound()
  }

  const detailPath = `${COMMUNITY_PATH}/${post.id}`

  if (user === null) {
    redirect(`/login?next=${encodeURIComponent(`${detailPath}/edit`)}`)
  }

  if (!isAuthor(post.authorId, user.id)) {
    redirect(detailPath)
  }

  return (
    <PageShell variant="community" title="글 수정">
      <ListSheet className="mt-6">
        <PostForm
          postId={post.id}
          defaultValues={{ category: post.category, title: post.title, content: post.body }}
        />
      </ListSheet>

      <BackToListLink href={detailPath} />
    </PageShell>
  )
}
