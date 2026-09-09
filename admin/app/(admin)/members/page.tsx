import { MemberFilters } from '@/components/members/MemberFilters'
import {
  MaskedEmail,
  MemberIdentity,
  MemberStatusBadges,
} from '@/components/members/MemberIdentity'
import { Card } from '@/components/ui/Card'
import { FormBanner } from '@/components/ui/FormField'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { Table, type Column } from '@/components/ui/Table'
import { requirePermission } from '@/lib/auth/require-admin'
import { LIST_LOAD_ERROR } from '@/lib/constants/messages'
import { getMembers, type MemberListItem } from '@/lib/data/members'
import { formatDate } from '@/lib/utils/format-date'
import { buildHref, DEFAULT_PAGE_SIZE, sortHref, totalPages } from '@/lib/utils/table-query'
import { parseMemberListParams } from '@/lib/validation/member-list-params'
import { memberLifecycle, purgeDueAt } from '@/lib/validation/member-status'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '회원',
}

export const dynamic = 'force-dynamic'

const PATH = '/members'

export default async function MembersPage(props: PageProps<'/members'>) {
  await requirePermission('members', 'read')
  const searchParams = await props.searchParams
  const params = parseMemberListParams(searchParams)
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
      /* 파기된 회원은 이메일이 없다. 마스킹 함수가 이미 '-' 를 돌려주므로 분기하지
         않는다 — 화면에는 "지워졌다"가 아니라 "값이 없다"로만 보이면 충분하다. */
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
      className: 'w-44',
      cell: (row) => (
        <span className="flex flex-col gap-1">
          <MemberStatusBadges
            role={row.role}
            suspendedUntil={row.suspendedUntil}
            deletedAt={row.deletedAt}
            purgedAt={row.purgedAt}
          />
          {/* 탈퇴 대기 행에만 파기 예정일을 붙인다. D-day 만으로는 언제까지인지
              달력에 옮겨 적을 수 없어, 운영자가 매번 90일을 손으로 더한다. */}
          {memberLifecycle(row) === 'withdrawn' && (
            <span className="text-muted text-[11px]">
              파기 예정 {formatDate(purgeDueAt(row.deletedAt))}
            </span>
          )}
        </span>
      ),
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
