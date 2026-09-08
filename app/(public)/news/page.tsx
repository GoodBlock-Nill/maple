import { CategoryChips } from '@/components/board/CategoryChips'
import { ListSheet } from '@/components/board/ListSheet'
import { LoadMoreButton } from '@/components/board/LoadMoreButton'
import { NewsList } from '@/components/board/NewsList'
import { SearchForm } from '@/components/board/SearchForm'
import { ViewToggle } from '@/components/board/ViewToggle'
import { PageShell } from '@/components/layout/PageShell'
import {
  DEFAULT_NEWS_VIEW,
  NEWS_CATEGORIES,
  NEWS_CATEGORY_VALUES,
  NEWS_VIEW_VALUES,
} from '@/lib/constants/board'
import { getNewsList } from '@/lib/data/news'
import {
  buildHref,
  parseOption,
  parseOptionalOption,
  parsePage,
  parseQuery,
} from '@/lib/utils/list-query'

import type { NewsCategory, NewsView } from '@/types/domain'
import type { Metadata } from 'next'

const NEWS_PATH = '/news'
const NEWS_TITLE = '뉴스목록'

export const metadata: Metadata = {
  title: '뉴스',
  description: '글자월드의 공지사항, 패치노트, 이벤트 소식을 한곳에서 확인하세요.',
}

export default async function NewsPage(props: PageProps<'/news'>) {
  const searchParams = await props.searchParams
  const category = parseOptionalOption<NewsCategory>(searchParams.category, NEWS_CATEGORY_VALUES)
  const view = parseOption<NewsView>(searchParams.view, NEWS_VIEW_VALUES, DEFAULT_NEWS_VIEW)
  const q = parseQuery(searchParams.q)
  const page = parsePage(searchParams.page)

  const list = await getNewsList({ category, q, page })

  // 기본 뷰(타일)는 URL에서 생략해 링크를 정규화한다.
  const viewParam = view === DEFAULT_NEWS_VIEW ? null : view

  const categoryHref = (value: NewsCategory | null) =>
    buildHref(NEWS_PATH, { category: value, q, view: viewParam })
  const viewHref = (value: NewsView) =>
    buildHref(NEWS_PATH, {
      category,
      q,
      view: value === DEFAULT_NEWS_VIEW ? null : value,
    })

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
            keep={{ category, view: viewParam }}
            className="w-full lg:w-[300px]"
          />
          <ViewToggle active={view} hrefFor={viewHref} className="hidden lg:block" />
        </div>
      </div>

      <ListSheet className="mt-6">
        <NewsList items={list.items} view={view} />
      </ListSheet>

      <LoadMoreButton
        href={buildHref(NEWS_PATH, { category, q, view: viewParam, page: page + 1 })}
        shown={list.shown}
        total={list.total}
      />
    </PageShell>
  )
}
