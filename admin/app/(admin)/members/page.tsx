import { MemberFilters } from '@/components/members/MemberFilters'
import { MaskedEmail, MemberIdentity, MemberStatusBadge } from '@/components/members/MemberIdentity'
import { Card } from '@/components/ui/Card'
import { FormBanner } from '@/components/ui/FormField'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { Table, type Column } from '@/components/ui/Table'
import { requirePermission } from '@/lib/auth/require-admin'
import { LIST_LOAD_ERROR } from '@/lib/constants/messages'
import { getMembers, type MemberListItem, type MemberListParams } from '@/lib/data/members'
import { formatDate } from '@/lib/utils/format-date'
import {
  buildHref,
  DEFAULT_PAGE_SIZE,
  firstValue,
  parsePage,
  parseSort,
  sortHref,
  totalPages,
  type QueryParams,
  type SortState,
} from '@/lib/utils/table-query'
import {
  MEMBER_PROVIDERS,
  MEMBER_STATUS_FILTERS,
  type MemberProvider,
  type MemberStatusFilter,
} from '@/lib/validation/members'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '회원',
}

export const dynamic = 'force-dynamic'

const PATH = '/members'
const SORT_KEYS = ['created_at', 'nickname'] as const
const DEFAULT_SORT: SortState = { key: 'created_at', direction: 'desc' }

/** 쿼리스트링 → 조회 파라미터. 허용 목록 밖의 값은 "전체"로 떨어진다. */
function parseParams(params: QueryParams): MemberListParams {
  const status = firstValue(params.status)
  const provider = firstValue(params.provider)

  return {
    q: firstValue(params.q),
    status: MEMBER_STATUS_FILTERS.includes(status as MemberStatusFilter)
      ? (status as MemberStatusFilter)
      : null,
    provider: MEMBER_PROVIDERS.includes(provider as MemberProvider)
      ? (provider as MemberProvider)
      : null,
    from: firstValue(params.from),
    to: firstValue(params.to),
    sort: parseSort(params.sort, SORT_KEYS, DEFAULT_SORT),
    page: parsePage(params.page),
  }
}

export default async function MembersPage(props: PageProps<'/members'>) {
  await requirePermission('members', 'read')
  const searchParams = await props.searchParams
  const params = parseParams(searchParams)
  const list = await getMembers(params)

  const columns: readonly Column<MemberListItem>[] = [
    {
      key: 'nickname',
      header: '닉네임',
      sortKey: 'nickname',
      cell: (row) => (
        <MemberIdentity
          nickname={row.nickname}
          provider={row.provider}
          href={`${PATH}/${row.id}`}
        />
      ),
    },
    {
      key: 'email',
      header: '이메일',
      className: 'w-52',
      cell: (row) => <MaskedEmail email={row.email} />,
    },
    {
      key: 'created_at',
      header: '가입일',
      sortKey: 'created_at',
      className: 'w-28',
      cell: (row) => <span className="text-muted">{formatDate(row.createdAt)}</span>,
    },
    {
      key: 'posts',
      header: '글',
      align: 'right',
      className: 'w-14',
      cell: (row) => row.postCount,
    },
    {
      key: 'comments',
      header: '댓글',
      align: 'right',
      className: 'w-14',
      cell: (row) => row.commentCount,
    },
    {
      key: 'reported',
      header: '신고당함',
      align: 'right',
      className: 'w-20',
      cell: (row) => (
        <span className={row.reportedCount > 0 ? 'text-danger font-bold' : undefined}>
          {row.reportedCount}
        </span>
      ),
    },
    {
      key: 'status',
      header: '상태',
      className: 'w-32',
      cell: (row) => <MemberStatusBadge role={row.role} suspendedUntil={row.suspendedUntil} />,
    },
  ]

  return (
    <>
      <PageHeader
        title="회원"
        description={`총 ${list.count.toLocaleString('ko-KR')}명. 닉네임을 눌러 상세로 이동합니다.`}
      />

      <MemberFilters pathname={PATH} params={searchParams} />

      {list.hasError && (
        <div className="mb-3">
          <FormBanner message={LIST_LOAD_ERROR} />
        </div>
      )}

      <Card>
        <Table
          columns={columns}
          rows={list.rows}
          getRowKey={(row) => row.id}
          sort={params.sort}
          buildSortHref={(key) => sortHref(PATH, searchParams, params.sort, key)}
          caption="회원 목록"
          emptyMessage="조건에 맞는 회원이 없습니다."
        />
        <Pagination
          page={list.page}
          total={totalPages(list.count, DEFAULT_PAGE_SIZE)}
          buildHref={(page) => buildHref(PATH, searchParams, { page: String(page) })}
        />
      </Card>
    </>
  )
}
