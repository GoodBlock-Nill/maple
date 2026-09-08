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
 * 커뮤니티 목록과 같은 이유로 세그먼트 `revalidate` 를 걷어냈다. 신선도는
 * `getNewsList` 가 `news-list` 태그로 소유하고, 관리자 앱이 `POST /api/revalidate` 로
 * 태그를 태우면 다음 요청에서 반영된다(`lib/data/news.ts` · `lib/data/cache.ts`).
 */

const NEWS_PATH = '/news'
const NEWS_TITLE = '뉴스목록'

export const metadata: Metadata = {
  title: '뉴스',
  description:
    '글자월드의 공지사항, 점검안내, 업데이트 안내, 패치노트, 이벤트, 안내사항을 한곳에서 확인하세요.',
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
        {/* 말머리 6종 + 전체는 390 폭에 한 줄로 담기지 않는다. 가로 스크롤 대신
            줄바꿈으로 전부 보여 준다. */}
        <CategoryChips
          label="뉴스 카테고리"
          items={NEWS_CATEGORIES}
          active={category}
          hrefFor={categoryHref}
          wrap
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
