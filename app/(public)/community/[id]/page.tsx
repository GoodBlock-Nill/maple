import Image from 'next/image'
import { notFound } from 'next/navigation'

import { ArticleCard } from '@/components/board/ArticleCard'
import { BackToListLink } from '@/components/board/BackToListLink'
import { CommentSection } from '@/components/board/CommentSection'
import { ListSheet } from '@/components/board/ListSheet'
import { Markdown } from '@/components/board/Markdown'
import { PostActions } from '@/components/board/PostActions'
import { ViewCounter } from '@/components/board/ViewCounter'
import { PageShell } from '@/components/layout/PageShell'
import { getCurrentUser } from '@/lib/auth/current-user'
import { COMMUNITY_CATEGORY_MAP } from '@/lib/constants/board'
import { getPostById } from '@/lib/data/community'
import { isEdited } from '@/lib/utils/authorship'
import { maskNickname } from '@/lib/utils/mask'

import type { Metadata } from 'next'

const COMMUNITY_PATH = '/community'
const COMMUNITY_TITLE = '자유게시판'
const LIKE_NOTICE_ID = 'like-notice'

export async function generateMetadata(props: PageProps<'/community/[id]'>): Promise<Metadata> {
  const { id } = await props.params
  const post = await getPostById(id)

  if (post === null) {
    return { title: '찾을 수 없는 글' }
  }

  return {
    title: post.title,
    description: post.body.slice(0, 120),
    openGraph: { title: post.title, type: 'article' },
  }
}

export default async function CommunityDetailPage(props: PageProps<'/community/[id]'>) {
  const { id } = await props.params
  const [post, user] = await Promise.all([getPostById(id), getCurrentUser()])

  if (post === null) {
    notFound()
  }

  const category = COMMUNITY_CATEGORY_MAP[post.category]
  const detailPath = `${COMMUNITY_PATH}/${post.id}`
  const viewerId = user?.id ?? null

  return (
    <PageShell variant="community" title={COMMUNITY_TITLE}>
      <ListSheet className="mt-6">
        <ArticleCard
          badge={{ label: category.label, color: category.badge }}
          title={post.title}
          date={post.createdAt}
          views={post.views}
          likes={post.likes}
          aside={
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-ink-muted text-[18px] font-medium">
                {maskNickname(post.author)}
              </span>
              <PostActions
                postId={post.id}
                authorId={post.authorId}
                viewerId={viewerId}
                detailPath={detailPath}
              />
            </div>
          }
          note={
            isEdited(post.editedAt) ? (
              <span className="text-ink-muted text-[14px] font-medium">수정됨</span>
            ) : null
          }
        >
          <Markdown>{post.body}</Markdown>

          <div className="mt-10 flex flex-col items-center gap-2">
            <button
              type="button"
              disabled
              aria-describedby={LIKE_NOTICE_ID}
              className="cta-light rounded-pill text-ink inline-flex h-11 items-center gap-2 px-6 text-[16px] font-medium opacity-60"
            >
              <Image src="/images/brand/icon-like.svg" alt="" width={11} height={12} aria-hidden />
              좋아요 {post.likes}
            </button>
            <p id={LIKE_NOTICE_ID} className="text-ink-muted text-[14px]">
              로그인 후 이용할 수 있습니다.
            </p>
          </div>

          <CommentSection
            postId={post.id}
            comments={post.comments}
            isAuthenticated={user !== null}
            viewerId={viewerId}
          />
        </ArticleCard>
      </ListSheet>

      {/* 렌더 중에는 쿠키를 쓸 수 없어 마운트 후 서버 액션으로 집계한다. */}
      <ViewCounter postId={post.id} />

      <BackToListLink href={COMMUNITY_PATH} />
    </PageShell>
  )
}
