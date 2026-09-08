import { BoardEmpty } from '@/components/board/BoardEmpty'
import { FilterChips } from '@/components/board/FilterChips'
import { ListSheet } from '@/components/board/ListSheet'
import { LoadMoreButton } from '@/components/board/LoadMoreButton'
import { SearchForm } from '@/components/board/SearchForm'
import { SortMenu } from '@/components/board/SortMenu'
import { GachaDetailModal } from '@/components/guide/GachaDetailModal'
import { GachaItemCard } from '@/components/guide/GachaItemCard'
import { ComingSoon } from '@/components/layout/ComingSoon'
import { PageShell } from '@/components/layout/PageShell'
import { FEATURES } from '@/lib/constants/features'
import {
  DEFAULT_GACHA_SORT,
  DEFAULT_GACHA_TAB,
  GACHA_ITEM_PARAM,
  GACHA_SORT_VALUES,
  GACHA_SORTS,
  GACHA_TAB_VALUES,
  GACHA_TABS,
} from '@/lib/constants/guide'
import { getGachaItemById, getGachaList } from '@/lib/data/gacha'
import { buildHref, firstValue, parseOption, parsePage, parseQuery } from '@/lib/utils/list-query'

import type { FilterChipOption } from '@/components/board/FilterChips'
import type { GachaSort, GachaTab } from '@/types/domain'
import type { Metadata } from 'next'

const GUIDE_PATH = '/guide'
const GUIDE_TITLE = '확률형 아이템 정보'

export const metadata: Metadata = {
  title: '가이드',
  description:
    '글자월드 확률형 아이템의 등급별 획득 확률을 부화기·큐브·주문서 종류별로 확인하세요.',
  // 오너 요청: 9/18 오픈 시점에는 서비스하지 않아 검색 노출도 함께 막는다.
  // 오픈 후(FEATURES.guideOpen === true)에는 robots 필드를 아예 넣지 않아
  // Next 기본값(인덱싱 허용)을 그대로 따른다.
  ...(FEATURES.guideOpen ? {} : { robots: { index: false, follow: false } }),
}

/** 탭 칩에는 "전체"가 없다(시안 GNB 와 동일하게 첫 탭이 기본 선택). */
const TAB_OPTIONS: readonly FilterChipOption<GachaTab>[] = GACHA_TABS.map((tab) => ({
  value: tab.value,
  label: tab.label,
}))

export default async function GuidePage(props: PageProps<'/guide'>) {
  // 오너 요청: 9/18 오픈 시점에는 미제공. 플래그가 꺼져 있으면 Supabase
  // 조회 자체를 건너뛰고 "서비스 준비 중" 카드만 그린다.
  if (!FEATURES.guideOpen) {
    return (
      <PageShell variant="guide" title={GUIDE_TITLE}>
        <ComingSoon variant="guide" />
      </PageShell>
    )
  }

  const searchParams = await props.searchParams
  const tab = parseOption<GachaTab>(searchParams.tab, GACHA_TAB_VALUES, DEFAULT_GACHA_TAB)
  const sort = parseOption<GachaSort>(searchParams.sort, GACHA_SORT_VALUES, DEFAULT_GACHA_SORT)
  const q = parseQuery(searchParams.q)
  const page = parsePage(searchParams.page)
  const itemId = firstValue(searchParams[GACHA_ITEM_PARAM])

  const [list, detail] = await Promise.all([
    getGachaList({ tab, sort, q, page }),
    itemId === undefined ? Promise.resolve(null) : getGachaItemById(itemId),
  ])

  // 기본 탭·정렬은 URL 에서 생략해 링크를 정규화한다.
  const tabParam = tab === DEFAULT_GACHA_TAB ? null : tab
  const sortParam = sort === DEFAULT_GACHA_SORT ? null : sort
  const listHref = buildHref(GUIDE_PATH, { tab: tabParam, sort: sortParam, q, page })

  return (
    <PageShell
      variant="guide"
      title={GUIDE_TITLE}
      overlay={detail === null ? null : <GachaDetailModal item={detail} closeHref={listHref} />}
    >
      <FilterChips
        label="확률형 아이템 종류"
        options={TAB_OPTIONS}
        active={tab}
        hrefFor={(value) =>
          buildHref(GUIDE_PATH, {
            tab: value === DEFAULT_GACHA_TAB ? null : value,
            sort: sortParam,
            q,
          })
        }
      />

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SortMenu
          options={GACHA_SORTS}
          active={sort}
          hrefFor={(value) =>
            buildHref(GUIDE_PATH, {
              tab: tabParam,
              sort: value === DEFAULT_GACHA_SORT ? null : value,
              q,
              [GACHA_ITEM_PARAM]: itemId,
            })
          }
        />
        <SearchForm
          action={GUIDE_PATH}
          defaultValue={q}
          keep={{ tab: tabParam, sort: sortParam }}
          className="w-full sm:w-[300px]"
        />
      </div>

      <ListSheet className="mt-6">
        {list.items.length === 0 ? (
          <BoardEmpty
            title="표시할 아이템이 없습니다"
            description="검색어나 종류를 바꿔서 다시 찾아보세요."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.items.map((item) => (
              <GachaItemCard
                key={item.id}
                item={item}
                href={buildHref(GUIDE_PATH, {
                  tab: tabParam,
                  sort: sortParam,
                  q,
                  page,
                  [GACHA_ITEM_PARAM]: item.id,
                })}
              />
            ))}
          </div>
        )}
      </ListSheet>

      <LoadMoreButton
        href={buildHref(GUIDE_PATH, { tab: tabParam, sort: sortParam, q, page: page + 1 })}
        shown={list.shown}
        total={list.total}
      />
    </PageShell>
  )
}
