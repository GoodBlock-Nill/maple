import { notFound } from 'next/navigation'

import { ArticleCard } from '@/components/board/ArticleCard'
import { BackToListLink } from '@/components/board/BackToListLink'
import { ListSheet } from '@/components/board/ListSheet'
import { Markdown } from '@/components/board/Markdown'
import { PageShell } from '@/components/layout/PageShell'
import { NEWS_CATEGORY_MAP } from '@/lib/constants/board'
import { getNewsById } from '@/lib/data/news'

import type { Metadata } from 'next'

const NEWS_PATH = '/news'
const NEWS_TITLE = '뉴스목록'

export async function generateMetadata(props: PageProps<'/news/[id]'>): Promise<Metadata> {
  const { id } = await props.params
  const item = await getNewsById(id)

  if (item === null) {
    return { title: '찾을 수 없는 소식' }
  }

  return {
    title: item.title,
    description: item.summary,
    openGraph: { title: item.title, description: item.summary, type: 'article' },
  }
}

export default async function NewsDetailPage(props: PageProps<'/news/[id]'>) {
  const { id } = await props.params
  const item = await getNewsById(id)

  if (item === null) {
    notFound()
  }

  const category = NEWS_CATEGORY_MAP[item.category]

  return (
    <PageShell variant="news" title={NEWS_TITLE}>
      <ListSheet className="mt-6">
        <ArticleCard
          badge={{ label: category.label, color: category.badge }}
          title={item.title}
          date={item.publishedAt}
          views={item.views}
        >
          <Markdown>{item.body}</Markdown>
        </ArticleCard>
      </ListSheet>

      <BackToListLink href={NEWS_PATH} />
    </PageShell>
  )
}
