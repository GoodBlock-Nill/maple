import { notFound } from 'next/navigation'

import { AdjacentPostNav } from '@/components/board/AdjacentPostNav'
import { ArticleCard } from '@/components/board/ArticleCard'
import { BackToListLink } from '@/components/board/BackToListLink'
import { ListSheet } from '@/components/board/ListSheet'
import { NewsBanner } from '@/components/board/NewsBanner'
import { PostBody } from '@/components/board/PostBody'
import { ShareButton } from '@/components/board/ShareButton'
import { ViewCounter } from '@/components/board/ViewCounter'
import { PageShell } from '@/components/layout/PageShell'
import { NEWS_CATEGORY_MAP } from '@/lib/constants/board'
import { getNewsBanner } from '@/lib/constants/news-banners'
import { getAdjacentNews, getNewsById } from '@/lib/data/news'
import { absoluteUrl } from '@/lib/utils/absolute-url'
import { isEdited } from '@/lib/utils/authorship'
import { newsShareUrl } from '@/lib/utils/share'

import type { Metadata } from 'next'

const NEWS_PATH = '/news'
const NEWS_TITLE = '뉴스목록'

export async function generateMetadata(props: PageProps<'/news/[id]'>): Promise<Metadata> {
  const { id } = await props.params
  const item = await getNewsById(id)

  if (item === null) {
    return { title: '찾을 수 없는 소식' }
  }

  /* 공유 카드 이미지는 말머리 배너를 그대로 쓴다. 크롤러가 외부에서 받아 가므로
     절대 URL 이어야 한다. */
  const banner = getNewsBanner(item.category)
  const canonical = newsShareUrl(item.id)
  const image = {
    url: absoluteUrl(banner.src),
    width: banner.width,
    height: banner.height,
    alt: banner.alt,
  }

  return {
    title: item.title,
    description: item.summary,
    /* 공유 버튼이 복사하는 주소와 크롤러가 정본으로 삼는 주소를 같게 맞춘다. */
    alternates: { canonical },
    openGraph: {
      title: item.title,
      description: item.summary,
      type: 'article',
      url: canonical,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: item.title,
      description: item.summary,
      images: [image],
    },
  }
}

export default async function NewsDetailPage(props: PageProps<'/news/[id]'>) {
  const { id } = await props.params
  const item = await getNewsById(id)

  if (item === null) {
    notFound()
  }

  const category = NEWS_CATEGORY_MAP[item.category]
  const { prev, next } = await getAdjacentNews(item.id, item.publishedAt)

  return (
    <PageShell variant="news" title={NEWS_TITLE}>
      <ListSheet className="mt-6">
        <ArticleCard
          badge={{ label: category.label, color: category.badge }}
          banner={<NewsBanner category={item.category} />}
          title={item.title}
          date={item.publishedAt}
          views={item.views}
          metaAside={
            <ShareButton title={item.title} text={item.summary} url={newsShareUrl(item.id)} />
          }
          note={
            isEdited(item.editedAt) ? (
              <span className="text-ink-muted text-[14px] font-medium">수정됨</span>
            ) : null
          }
        >
          <PostBody format={item.contentFormat} body={item.body} />
        </ArticleCard>
      </ListSheet>

      {/* 렌더 중에는 쿠키를 쓸 수 없어 마운트 후 서버 액션으로 집계한다. */}
      <ViewCounter postId={item.id} />

      <AdjacentPostNav basePath={NEWS_PATH} prev={prev} next={next} />

      <BackToListLink href={NEWS_PATH} />
    </PageShell>
  )
}
