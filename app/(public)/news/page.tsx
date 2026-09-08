import { CategoryChips } from '@/components/board/CategoryChips'
import { ListSheet } from '@/components/board/ListSheet'
import { LoadMoreButton } from '@/components/board/LoadMoreButton'
import { NewsList } from '@/components/board/NewsList'
import { SearchForm } from '@/components/board/SearchForm'
import { PageShell } from '@/components/layout/PageShell'
import { NEWS_CATEGORIES, NEWS_CATEGORY_VALUES } from '@/lib/constants/board'
import { getNewsList } from '@/lib/data/news'
import { buildHref, parseOptionalOption, parsePage, parseQuery } from '@/lib/utils/list-query'

import type { NewsCategory } from '@/types/domain'
import type { Metadata } from 'next'

/**
 * 목록은 세션에 따라 달라지지 않지만, Supabase 서버 클라이언트가 쿠키를 읽어
 * 라우트가 동적으로 렌더된다. 세그먼트 기본 재검증 주기를 데이터 계층
 * (`LIST_REVALIDATE_SECONDS`)과 맞춰 두면, 이후 캐시 가능한 데이터가 추가돼도
 * 신선도 기준이 한곳에서 유지된다.
 */
export const revalidate = 60

const NEWS_PATH = '/news'
const NEWS_TITLE = '뉴스목록'

export const metadata: Metadata = {
  title: '뉴스',
  description: '글자월드의 공지사항, 패치노트, 이벤트 소식을 한곳에서 확인하세요.',
}

export default async function NewsPage(props: PageProps<'/news'>) {
  const searchParams = await props.searchParams
  const category = parseOptionalOption<NewsCategory>(searchParams.category, NEWS_CATEGORY_VALUES)
  const q = parseQuery(searchParams.q)
  const page = parsePage(searchParams.page)

  const list = await getNewsList({ category, q, page })

  const categoryHref = (value: NewsCategory | null) => buildHref(NEWS_PATH, { category: value, q })

  return (
    <PageShell variant="news" title={NEWS_TITLE}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <CategoryChips
          label="뉴스 카테고리"
          items={NEWS_CATEGORIES}
          active={category}
          hrefFor={categoryHref}
        />

        <div className="flex items-center gap-[15px]">
          <SearchForm
            action={NEWS_PATH}
            defaultValue={q}
            keep={{ category }}
            className="w-full lg:w-[300px]"
          />
        </div>
      </div>

      <ListSheet className="mt-6">
        <NewsList items={list.items} />
      </ListSheet>

      <LoadMoreButton
        href={buildHref(NEWS_PATH, { category, q, page: page + 1 })}
        shown={list.shown}
        total={list.total}
      />
    </PageShell>
  )
}
