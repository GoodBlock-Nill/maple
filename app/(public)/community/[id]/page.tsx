import { notFound } from 'next/navigation'

import { ArticleCard } from '@/components/board/ArticleCard'
import { BackToListLink } from '@/components/board/BackToListLink'
import { CommentSection } from '@/components/board/CommentSection'
import { LikeButton } from '@/components/board/LikeButton'
import { ListSheet } from '@/components/board/ListSheet'
import { PostActions } from '@/components/board/PostActions'
import { PostBody } from '@/components/board/PostBody'
import { ViewCounter } from '@/components/board/ViewCounter'
import { PageShell } from '@/components/layout/PageShell'
import { getCurrentUser } from '@/lib/auth/current-user'
import { COMMUNITY_CATEGORY_MAP } from '@/lib/constants/board'
import { getPostById, getPostLikeState } from '@/lib/data/community'
import { isEdited } from '@/lib/utils/authorship'
import { maskNickname } from '@/lib/utils/mask'
import { suspensionNotice } from '@/lib/utils/suspension'
import { postHtmlText } from '@/lib/utils/post-html'

import type { Metadata } from 'next'
import type { Post } from '@/types/domain'

const COMMUNITY_PATH = '/community'
const COMMUNITY_TITLE = '자유게시판'

/** 메타 설명에는 태그가 아니라 사람이 읽는 글이 들어가야 한다. */
function postSummaryText(post: Post): string {
  return post.contentFormat === 'html' ? postHtmlText(post.body) : post.body
}

export async function generateMetadata(props: PageProps<'/community/[id]'>): Promise<Metadata> {
  const { id } = await props.params
  const post = await getPostById(id)

  if (post === null) {
    return { title: '찾을 수 없는 글' }
  }

  return {
    title: post.title,
    description: postSummaryText(post).slice(0, 120),
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
  const liked = await getPostLikeState(post.id, viewerId)
  /* 본인 정지 상태만 내려간다. 남의 제재 여부는 `profiles_select_self` 때문에
     애초에 조회되지 않는다. */
  const suspended = suspensionNotice(user)

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
                suspensionNotice={suspended}
              />
            </div>
          }
          note={
            isEdited(post.editedAt) ? (
              <span className="text-ink-muted text-[14px] font-medium">수정됨</span>
            ) : null
          }
        >
          <PostBody format={post.contentFormat} body={post.body} />

          <div className="mt-10 flex justify-center">
            <LikeButton
              postId={post.id}
              liked={liked}
              likeCount={post.likes}
              detailPath={detailPath}
              isAuthenticated={user !== null}
              suspensionNotice={suspended}
            />
          </div>

          <CommentSection
            postId={post.id}
            comments={post.comments}
            isAuthenticated={user !== null}
            viewerId={viewerId}
            suspensionNotice={suspended}
          />
        </ArticleCard>
      </ListSheet>

      {/* 렌더 중에는 쿠키를 쓸 수 없어 마운트 후 서버 액션으로 집계한다. */}
      <ViewCounter postId={post.id} />

      <BackToListLink href={COMMUNITY_PATH} />
    </PageShell>
  )
}
