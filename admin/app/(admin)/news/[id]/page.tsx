import { notFound } from 'next/navigation'

import { NewsForm } from '@/components/news/NewsForm'
import { NewsPreview } from '@/components/news/NewsPreview'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  NEWS_STATUS_LABEL,
  NEWS_STATUS_TONE,
  NEWS_VISIBILITY_LABEL,
  NEWS_VISIBILITY_TONE,
} from '@/lib/constants/news'
import { requirePermission } from '@/lib/auth/require-admin'
import { getNewsPost, listNewsCategories } from '@/lib/data/news'
import { clientSiteUrl } from '@/lib/supabase/env'
import { formatDateTime } from '@/lib/utils/format-date'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '뉴스 수정',
}

export const dynamic = 'force-dynamic'

export default async function EditNewsPage(props: PageProps<'/news/[id]'>) {
  await requirePermission('news', 'write')
  const { id } = await props.params
  const [post, categories] = await Promise.all([getNewsPost(id), listNewsCategories()])

  if (post === null) {
    notFound()
  }

  const siteUrl = clientSiteUrl()

  return (
    <>
      <PageHeader
        title="뉴스 수정"
        description={`${post.authorName} 작성 · 조회 ${post.viewCount.toLocaleString('ko-KR')} · 최종 수정 ${formatDateTime(post.updatedAt)}${
          post.editedAt === null ? '' : ` · 본문 수정 ${formatDateTime(post.editedAt)}`
        }`}
        action={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={NEWS_STATUS_TONE[post.status]}>{NEWS_STATUS_LABEL[post.status]}</Badge>
            {/* 편집 상태와 별개로 "지금 독자에게 보이는가"를 함께 알린다. */}
            <Badge tone={NEWS_VISIBILITY_TONE[post.visibility]}>
              클라이언트 {NEWS_VISIBILITY_LABEL[post.visibility]}
            </Badge>
            <Button
              href={`${siteUrl}/news/${post.id}`}
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
            >
              클라이언트에서 보기
            </Button>
          </span>
        }
      />

      <NewsForm categories={categories} post={post} />

      <div className="mt-6" data-testid="news-preview">
        <NewsPreview post={post} clientSiteUrl={siteUrl} />
      </div>
    </>
  )
}
