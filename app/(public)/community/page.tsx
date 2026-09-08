import Image from 'next/image'

import { BoardEmpty } from '@/components/board/BoardEmpty'
import { CategoryChips } from '@/components/board/CategoryChips'
import { FlashNotice } from '@/components/board/FlashNotice'
import { ListSheet } from '@/components/board/ListSheet'
import { LoadMoreButton } from '@/components/board/LoadMoreButton'
import { PostRow } from '@/components/board/PostRow'
import { SearchForm } from '@/components/board/SearchForm'
import { SortSelect } from '@/components/board/SortSelect'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_CATEGORY_VALUES,
  COMMUNITY_SORT_VALUES,
  DEFAULT_COMMUNITY_SORT,
} from '@/lib/constants/board'
import { getCommunityList } from '@/lib/data/community'
import {
  buildHref,
  parseOption,
  parseOptionalOption,
  parsePage,
  parseQuery,
} from '@/lib/utils/list-query'

import type { CommunityCategory, CommunitySort } from '@/types/domain'
import type { Metadata } from 'next'

/**
 * 신선도는 이제 데이터 계층이 소유한다.
 *
 * 예전에는 세그먼트 설정(`export const revalidate = 60`)에 기댔는데, 그러면 관리자가
 * 글을 숨겼을 때 **상세는 즉시 404 인데 목록에는 최대 1분간 남아 있는** 틈이 생겼다.
 * 지금은 `getCommunityList` 가 `community-list` 태그로 캐시하고, 관리자 앱이
 * `POST /api/revalidate` 로 그 태그를 태우면 다음 요청에서 곧바로 사라진다
 * (`lib/data/community.ts` · `lib/data/cache.ts`).
 *
 * 라우트 자체는 레이아웃이 세션을 읽어(`getCurrentUser`) 어차피 매 요청 렌더된다.
 */

const COMMUNITY_PATH = '/community'
const COMMUNITY_TITLE = '자유게시판'
const WRITE_PATH = '/community/write'

export const metadata: Metadata = {
  title: '커뮤니티',
  description: '글자월드 모험가들이 잡담, 질문, 정보를 나누는 자유게시판입니다.',
}

export default async function CommunityPage(props: PageProps<'/community'>) {
  const searchParams = await props.searchParams
  const category = parseOptionalOption<CommunityCategory>(
    searchParams.category,
    COMMUNITY_CATEGORY_VALUES,
  )
  const sort = parseOption<CommunitySort>(
    searchParams.sort,
    COMMUNITY_SORT_VALUES,
    DEFAULT_COMMUNITY_SORT,
  )
  const q = parseQuery(searchParams.q)
  const page = parsePage(searchParams.page)
  /* 삭제 직후 리다이렉트(`?deleted=1`)로만 켜지는 1회성 안내. */
  const isDeleted = searchParams.deleted === '1'

  const list = await getCommunityList({ category, sort, q, page })

  // 기본 정렬(최신순)은 URL에서 생략해 링크를 정규화한다.
  const sortParam = sort === DEFAULT_COMMUNITY_SORT ? null : sort

  const categoryHref = (value: CommunityCategory | null) =>
    buildHref(COMMUNITY_PATH, { category: value, sort: sortParam, q })
  const sortHref = (value: CommunitySort) =>
    buildHref(COMMUNITY_PATH, {
      category,
      sort: value === DEFAULT_COMMUNITY_SORT ? null : value,
      q,
    })

  return (
    <PageShell variant="community" title={COMMUNITY_TITLE}>
      {isDeleted ? <FlashNotice param="deleted" message="게시글을 삭제했습니다." /> : null}

      <CategoryChips
        label="커뮤니티 카테고리"
        items={COMMUNITY_CATEGORIES}
        active={category}
        hrefFor={categoryHref}
      />

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SortSelect active={sort} hrefFor={sortHref} />

        <div className="flex items-center gap-[10px]">
          <SearchForm
            action={COMMUNITY_PATH}
            defaultValue={q}
            keep={{ category, sort: sortParam }}
            className="w-full sm:w-[300px]"
          />
          <Button
            href={WRITE_PATH}
            size="lg"
            className="w-[110px] gap-1.5 rounded-[10px] px-0 text-[17px]"
          >
            <Image
              src="/images/brand/icon-write.svg"
              alt=""
              width={25}
              height={25}
              aria-hidden
              className="shrink-0"
            />
            글쓰기
          </Button>
        </div>
      </div>

      <ListSheet className="mt-6">
        {list.items.length === 0 ? (
          <BoardEmpty />
        ) : (
          <div className="flex flex-col gap-3">
            {list.items.map((post) => (
              <PostRow key={post.id} post={post} />
            ))}
          </div>
        )}
      </ListSheet>

      <LoadMoreButton
        href={buildHref(COMMUNITY_PATH, { category, sort: sortParam, q, page: page + 1 })}
        shown={list.shown}
        total={list.total}
      />
    </PageShell>
  )
}
