'use client'

import Link from 'next/link'

import { NewsRowActions } from '@/components/news/NewsRowActions'
import { Badge } from '@/components/ui/Badge'
import {
  newsCategoryLabel,
  newsCategoryTone,
  NEWS_STATUS_LABEL,
  NEWS_STATUS_TONE,
  NEWS_VISIBILITY_LABEL,
  NEWS_VISIBILITY_TONE,
} from '@/lib/constants/news'
import { formatDateTime } from '@/lib/utils/format-date'

import type { Column } from '@/components/ui/Table'
import type { NewsListItem } from '@/lib/data/news'

/**
 * 목록 표의 컬럼 정의.
 *
 * `NewsTable` 에서 떼어 낸 이유는 길이뿐이다. 컬럼은 셀 렌더 함수를 들고 있어
 * 서버 컴포넌트로 내릴 수 없고(함수는 경계를 넘지 못한다) 선택 상태를 받아야
 * 하므로, 상태를 가진 표에서 호출하는 순수 팩터리로 둔다.
 */

const CHECKBOX_CLASS = 'accent-accent size-4 align-middle'

type ColumnDeps = {
  selected: readonly string[]
  allSelected: boolean
  onToggle: (id: string) => void
  onToggleAll: () => void
  /** 사용자 사이트 주소. 미리보기 링크의 접두사. */
  clientSiteUrl: string
}

export function buildNewsColumns({
  selected,
  allSelected,
  onToggle,
  onToggleAll,
  clientSiteUrl,
}: ColumnDeps): readonly Column<NewsListItem>[] {
  return [
    {
      key: 'select',
      className: 'w-10',
      header: (
        <input
          type="checkbox"
          aria-label="전체 선택"
          checked={allSelected}
          onChange={onToggleAll}
          className={CHECKBOX_CLASS}
        />
      ),
      cell: (row) => (
        <input
          type="checkbox"
          name="ids"
          value={row.id}
          aria-label={`${row.title} 선택`}
          checked={selected.includes(row.id)}
          onChange={() => onToggle(row.id)}
          className={CHECKBOX_CLASS}
        />
      ),
    },
    {
      key: 'title',
      header: '제목',
      sortKey: 'title',
      /* 나머지 컬럼이 전부 고정 폭이라 제목만 남은 자리를 먹는다. 최소 폭을 주지
         않으면 좁은 화면에서 글자 단위로 접혀 목록을 읽을 수 없다. */
      className: 'min-w-[220px]',
      cell: (row) => (
        <span className="flex items-center gap-1.5">
          {row.isPinned && <Badge tone="accent">고정</Badge>}
          <Link
            href={`/news/${row.id}`}
            className="focus-visible:outline-focus hover:text-accent-strong font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {row.title}
          </Link>
        </span>
      ),
    },
    {
      key: 'category',
      header: '카테고리',
      className: 'w-28',
      cell: (row) => (
        <Badge tone={newsCategoryTone(row.categoryKey)}>{newsCategoryLabel(row.categoryKey)}</Badge>
      ),
    },
    {
      /* 두 뱃지를 한 칸에 둔다. 편집 상태(운영자가 무엇을 했는가)만으로는 "지금
         독자에게 보이는가"를 알 수 없고, 둘을 다른 칸에 떼어 놓으면 함께 읽히지
         않는다. 노출 여부는 클라이언트 목록 쿼리와 같은 판정식에서 나온다. */
      key: 'status',
      header: '상태 · 노출',
      className: 'w-28',
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-1">
          <Badge tone={NEWS_STATUS_TONE[row.status]}>{NEWS_STATUS_LABEL[row.status]}</Badge>
          <Badge tone={NEWS_VISIBILITY_TONE[row.visibility]}>
            {NEWS_VISIBILITY_LABEL[row.visibility]}
          </Badge>
        </span>
      ),
    },
    {
      key: 'publishedAt',
      header: '발행일',
      sortKey: 'published_at',
      className: 'w-36 whitespace-nowrap',
      cell: (row) => <span className="text-muted">{formatDateTime(row.publishedAt)}</span>,
    },
    {
      key: 'viewCount',
      header: '조회수',
      sortKey: 'view_count',
      align: 'right',
      className: 'w-24 whitespace-nowrap',
      cell: (row) => row.viewCount.toLocaleString('ko-KR'),
    },
    {
      key: 'updatedAt',
      header: '수정일',
      sortKey: 'updated_at',
      className: 'w-36 whitespace-nowrap',
      cell: (row) => <span className="text-muted">{formatDateTime(row.updatedAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      className: 'w-56 whitespace-nowrap',
      cell: (row) => (
        <NewsRowActions
          id={row.id}
          title={row.title}
          status={row.status}
          previewUrl={`${clientSiteUrl}/news/${row.id}`}
        />
      ),
    },
  ]
}
