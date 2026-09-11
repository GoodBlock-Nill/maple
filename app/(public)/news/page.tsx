import { CategoryChips } from '@/components/board/CategoryChips'
import { ListSheet } from '@/components/board/ListSheet'
import { LoadMoreButton } from '@/components/board/LoadMoreButton'
import { NewsCardGrid } from '@/components/board/NewsCardGrid'
import { NewsList } from '@/components/board/NewsList'
import { NewsViewMenu } from '@/components/board/NewsViewMenu'
import { SearchForm } from '@/components/board/SearchForm'
import { PageShell } from '@/components/layout/PageShell'
import { NEWS_CATEGORIES, NEWS_CATEGORY_VALUES } from '@/lib/constants/board'
import { getNewsList } from '@/lib/data/news'
import { buildHref, parseOptionalOption, parsePage, parseQuery } from '@/lib/utils/list-query'
import { newsViewParam, parseNewsView } from '@/lib/utils/news-view'

import type { NewsCategory, NewsView } from '@/types/domain'
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
  const view = parseNewsView(searchParams.view)
  /* 기본 보기(card)는 URL 에서 빼 둔다 — 칩·검색·더보기 링크가 전부 이 값을 실어 나른다. */
  const keptView = newsViewParam(view)

  const list = await getNewsList({ category, q, page })

  const categoryHref = (value: NewsCategory | null) =>
    buildHref(NEWS_PATH, { category: value, q, view: keptView })
  const viewHref = (value: NewsView) =>
    buildHref(NEWS_PATH, { category, q, view: newsViewParam(value) })
  /* 링크는 서버에서 미리 만들어 넘긴다 — 클라이언트 컴포넌트에 함수를 넘길 수 없다. */
  const viewHrefs: Record<NewsView, string> = { card: viewHref('card'), list: viewHref('list') }

  return (
    <PageShell variant="news" title={NEWS_TITLE}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* 말머리 6종 + 전체는 390 폭에 한 줄로 담기지 않지만, 폰에서는 줄바꿈 대신
            한 줄 가로 스크롤로 보여 준다(실기기 피드백 2026-09-09). */}
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
            keep={{ category, view: keptView }}
            className="w-full lg:w-[300px]"
          />
          <NewsViewMenu current={view} hrefs={viewHrefs} />
        </div>
      </div>

      {/* 카드형·리스트형 둘 다 폰에서 트레이 여백을 12 로 줄인다(시안 v2 §3·§5) — 두 뷰가
          같은 카드 표면(패딩 20)을 쓰므로 기본 16 을 그대로 두면 본문 폭이 눈에 띄게 깎인다. */}
      <ListSheet className="mt-6 p-3 lg:p-4">
        {view === 'card' ? <NewsCardGrid items={list.items} /> : <NewsList items={list.items} />}
      </ListSheet>

      <LoadMoreButton
        href={buildHref(NEWS_PATH, { category, q, page: page + 1, view: keptView })}
        shown={list.shown}
        total={list.total}
      />
    </PageShell>
  )
}
