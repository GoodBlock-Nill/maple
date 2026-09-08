import { BoardEmpty } from '@/components/board/BoardEmpty'
import { FilterChips } from '@/components/board/FilterChips'
import { ListSheet } from '@/components/board/ListSheet'
import { LoadMoreButton } from '@/components/board/LoadMoreButton'
import { SearchForm } from '@/components/board/SearchForm'
import { PageShell } from '@/components/layout/PageShell'
import { RankingTable } from '@/components/ranking/RankingTable'
import { TopThree } from '@/components/ranking/TopThree'
import {
  ALL_JOB_LABEL,
  DEFAULT_RANKING_TYPE,
  JOB_GROUP_VALUES,
  JOB_GROUPS,
  RANKING_TYPE_VALUES,
  RANKING_TYPES,
} from '@/lib/constants/ranking'
import { getRankingList } from '@/lib/data/rankings'
import {
  buildHref,
  parseOption,
  parseOptionalOption,
  parsePage,
  parseQuery,
} from '@/lib/utils/list-query'

import type { FilterChipOption } from '@/components/board/FilterChips'
import type { JobGroup, RankingType } from '@/types/domain'
import type { Metadata } from 'next'

const RANKING_PATH = '/ranking'
const RANKING_TITLE = '랭킹'

export const metadata: Metadata = {
  title: '랭킹',
  description: '글자월드의 종합·직업·길드 랭킹을 직업군별로 확인하세요.',
}

/** 종류 칩에는 "전체"가 없다. 첫 항목(종합 랭킹)이 기본 선택이다. */
const TYPE_OPTIONS: readonly FilterChipOption<RankingType>[] = RANKING_TYPES.map((type) => ({
  value: type.value,
  label: type.label,
}))

const JOB_OPTIONS: readonly FilterChipOption<JobGroup>[] = [
  { value: null, label: ALL_JOB_LABEL },
  ...JOB_GROUPS.map((group) => ({ value: group.value, label: group.label })),
]

export default async function RankingPage(props: PageProps<'/ranking'>) {
  const searchParams = await props.searchParams
  const type = parseOption<RankingType>(
    searchParams.type,
    RANKING_TYPE_VALUES,
    DEFAULT_RANKING_TYPE,
  )
  const job = parseOptionalOption<JobGroup>(searchParams.job, JOB_GROUP_VALUES)
  const q = parseQuery(searchParams.q)
  const page = parsePage(searchParams.page)

  const list = await getRankingList({ type, job, q, page })

  // 기본 종류(종합)는 URL 에서 생략해 링크를 정규화한다.
  const typeParam = type === DEFAULT_RANKING_TYPE ? null : type

  return (
    <PageShell variant="ranking" title={RANKING_TITLE}>
      <div className="flex flex-col gap-6">
        <FilterChips
          label="랭킹 종류"
          options={TYPE_OPTIONS}
          active={type}
          hrefFor={(value) =>
            buildHref(RANKING_PATH, {
              type: value === DEFAULT_RANKING_TYPE ? null : value,
              job,
              q,
            })
          }
        />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <FilterChips
            label="직업군"
            options={JOB_OPTIONS}
            active={job}
            hrefFor={(value) => buildHref(RANKING_PATH, { type: typeParam, job: value, q })}
          />
          <SearchForm
            action={RANKING_PATH}
            defaultValue={q}
            keep={{ type: typeParam, job }}
            className="w-full lg:w-[300px]"
          />
        </div>
      </div>

      {list.total === 0 ? (
        <ListSheet className="mt-6">
          <BoardEmpty
            title="표시할 랭킹이 없습니다"
            description="검색어나 직업군을 바꿔서 다시 찾아보세요."
          />
        </ListSheet>
      ) : (
        <>
          <TopThree entries={list.top} />
          {list.rows.length > 0 ? <RankingTable rows={list.rows} /> : null}
        </>
      )}

      <LoadMoreButton
        href={buildHref(RANKING_PATH, { type: typeParam, job, q, page: page + 1 })}
        shown={list.shown}
        total={list.total}
        hasMore={list.hasMore}
      />
    </PageShell>
  )
}
