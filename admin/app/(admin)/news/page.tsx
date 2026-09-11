import { NewsFilters } from '@/components/news/NewsFilters'
import { NewsTable } from '@/components/news/NewsTable'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { FormBanner } from '@/components/ui/FormField'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { hasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require-admin'
import { LIST_LOAD_ERROR } from '@/lib/constants/messages'
import { isNewsCategoryKey, isNewsStatus, NEWS_PIN_LIMIT } from '@/lib/constants/news'
import {
  getPinnedNewsSummary,
  listNews,
  listNewsCategories,
  NEWS_DEFAULT_SORT,
  NEWS_SORT_KEYS,
} from '@/lib/data/news'
import { clientSiteUrl } from '@/lib/supabase/env'
import { parseNewsPinnedFilter } from '@/lib/validation/news'
import {
  buildHref,
  firstValue,
  parsePage,
  parseSort,
  serializeSort,
  sortHref,
  totalPages,
} from '@/lib/utils/table-query'

import type { QueryParams } from '@/lib/utils/table-query'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '뉴스',
}

/* 목록은 요청마다 새로 읽는다. 운영자가 숨김·삭제를 누른 직후 확인하는 화면이라
   캐시된 값을 보여 주면 "반영이 안 됐다"는 오해를 부른다. */
export const dynamic = 'force-dynamic'

const NEWS_PATH = '/news'

export default async function NewsListPage(props: PageProps<'/news'>) {
  const { permissions } = await requirePermission('news', 'read')
  const canWrite = hasPermission(permissions, 'news', 'write')
  const query: QueryParams = await props.searchParams

  const categoryParam = firstValue(query.category)
  const statusParam = firstValue(query.status)
  const category = categoryParam !== null && isNewsCategoryKey(categoryParam) ? categoryParam : null
  const status = statusParam !== null && isNewsStatus(statusParam) ? statusParam : null
  const pinned = parseNewsPinnedFilter(firstValue(query.pinned))
  const q = firstValue(query.q) ?? ''
  const sort = parseSort(query.sort, NEWS_SORT_KEYS, NEWS_DEFAULT_SORT)
  const page = parsePage(query.page)

  const [list, categories, pinnedSummary] = await Promise.all([
    listNews({ category, status, pinned, q, sort, page }),
    listNewsCategories(),
    getPinnedNewsSummary(),
  ])

  /* 정렬 링크는 서버에서 미리 만든다 — 함수는 서버→클라이언트 경계를 넘지 못한다. */
  const sortHrefs = Object.fromEntries(
    NEWS_SORT_KEYS.map((key) => [key, sortHref(NEWS_PATH, query, sort, key)]),
  )

  return (
    <>
      <PageHeader
        title="뉴스"
        description="뉴스 게시글을 작성·수정하고 발행 상태를 관리합니다."
        action={
          canWrite ? (
            <span className="flex flex-wrap items-center gap-2">
              {/* 템플릿은 '다음 글을 어떻게 시작할 것인가' 라서 작성 버튼 옆이 자리다. */}
              <Button href={`${NEWS_PATH}/templates`} variant="secondary">
                카테고리 템플릿
              </Button>
              <Button href={`${NEWS_PATH}/new`}>새 뉴스 작성</Button>
            </span>
          ) : undefined
        }
      />

      {list.hasError && (
        <div className="mb-3">
          <FormBanner message={LIST_LOAD_ERROR} />
        </div>
      )}

      <Card>
        <CardBody className="border-line border-b">
          <NewsFilters
            categories={categories}
            category={category ?? ''}
            status={status ?? ''}
            pinned={pinned}
            q={q}
            sort={serializeSort(sort)}
            isFiltered={category !== null || status !== null || pinned || q !== ''}
          />
        </CardBody>

        <p className="text-muted border-line border-b px-5 py-2 text-[12px]">
          총 {list.total.toLocaleString('ko-KR')}건 · 고정{' '}
          {pinnedSummary.hasError ? '?' : pinnedSummary.count}/{NEWS_PIN_LIMIT}
          {status === null && ' · 삭제된 글은 상태 필터에서 "삭제"를 골라야 보입니다.'}
        </p>

        <NewsTable
          rows={list.items}
          sort={sort}
          sortHrefs={sortHrefs}
          clientSiteUrl={clientSiteUrl()}
          canWrite={canWrite}
        />

        <Pagination
          page={page}
          total={totalPages(list.total)}
          buildHref={(target) =>
            buildHref(NEWS_PATH, query, { page: target === 1 ? null : String(target) })
          }
        />
      </Card>
    </>
  )
}
