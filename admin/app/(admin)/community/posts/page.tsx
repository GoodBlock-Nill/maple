import { BulkHideBar, BulkSelectCheckbox } from '@/components/community/BulkHideBar'
import { CellLink, ContentFilters } from '@/components/community/ContentFilters'
import { ModerationActions } from '@/components/community/ModerationActions'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { FormBanner } from '@/components/ui/FormField'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { Table, type Column } from '@/components/ui/Table'
import { bulkHidePostsAction } from '@/lib/actions/moderation-actions'
import { hasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require-admin'
import { LIST_LOAD_ERROR } from '@/lib/constants/messages'
import {
  getCommunityCategoryLabels,
  getCommunityPosts,
  parsePostListParams,
  type PostListItem,
} from '@/lib/data/community'
import { clientSiteUrl } from '@/lib/supabase/env'
import { formatDateTime } from '@/lib/utils/format-date'
import { buildHref, DEFAULT_PAGE_SIZE, sortHref, totalPages } from '@/lib/utils/table-query'
import { contentStatus, CONTENT_STATUS_LABEL } from '@/lib/validation/moderation'

import type { BadgeTone } from '@/components/ui/Badge'
import type { ContentStatus } from '@/lib/validation/moderation'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '커뮤니티 게시글',
}

/* 목록은 조치 직후의 상태를 그대로 보여 줘야 한다. 정적 렌더 결과를 재사용하면
   숨김을 누른 뒤에도 이전 상태가 남는다. */
export const dynamic = 'force-dynamic'

const PATH = '/community/posts'

const STATUS_TONE: Record<ContentStatus, BadgeTone> = {
  visible: 'success',
  hidden: 'warn',
  deleted: 'danger',
}

export default async function CommunityPostsPage(props: PageProps<'/community/posts'>) {
  const { permissions } = await requirePermission('community', 'read')
  const canWrite = hasPermission(permissions, 'community', 'write')
  const searchParams = await props.searchParams
  const params = parsePostListParams(searchParams)
  const [list, categories] = await Promise.all([
    getCommunityPosts(params),
    getCommunityCategoryLabels(),
  ])

  /* 선택 열은 일괄 조치 전용이다. 읽기 전용 관리자에게는 열 자체를 뺀다 —
     남겨 두면 체크는 되는데 아무 버튼도 없는 표가 된다. */
  const columnDefs: (Column<PostListItem> | null)[] = [
    canWrite === false
      ? null
      : {
          key: 'select',
          header: <span className="sr-only">선택</span>,
          className: 'w-10',
          align: 'center',
          cell: (row) => (
            <BulkSelectCheckbox
              id={row.id}
              label={row.title}
              disabled={row.isHidden || row.deletedAt !== null}
            />
          ),
        },
    {
      key: 'title',
      header: '제목',
      className: 'min-w-[160px]',
      /* 제목이 곧 미리보기 링크다(사용자 사이트 원문, 새 탭). 삭제된 글은 상세가
         404 라 링크를 걸지 않는다. */
      cell: (row) =>
        row.deletedAt === null ? (
          <CellLink href={`${clientSiteUrl()}/community/${row.id}`} external>
            <span className="line-clamp-1" title={row.title}>
              {row.title}
            </span>
          </CellLink>
        ) : (
          <span className="text-muted line-clamp-1" title={row.title}>
            {row.title}
          </span>
        ),
    },
    {
      key: 'author',
      header: <span className="whitespace-nowrap">작성자</span>,
      className: 'w-28',
      cell: (row) =>
        row.authorId === null ? (
          <span className="text-muted">{row.authorName}</span>
        ) : (
          <CellLink href={`/members/${row.authorId}`}>{row.authorName}</CellLink>
        ),
    },
    {
      key: 'category',
      header: <span className="whitespace-nowrap">카테고리</span>,
      className: 'w-24',
      cell: (row) => <Badge>{categories[row.categoryKey] ?? row.categoryKey}</Badge>,
    },
    {
      key: 'status',
      header: '상태',
      className: 'w-20',
      cell: (row) => {
        const status = contentStatus(row)

        return <Badge tone={STATUS_TONE[status]}>{CONTENT_STATUS_LABEL[status]}</Badge>
      },
    },
    {
      key: 'comment_count',
      header: <span className="whitespace-nowrap">댓글</span>,
      sortKey: 'comment_count',
      align: 'right',
      className: 'w-20',
      cell: (row) => row.commentCount,
    },
    {
      key: 'like_count',
      header: <span className="whitespace-nowrap">좋아요</span>,
      sortKey: 'like_count',
      align: 'right',
      className: 'w-20',
      cell: (row) => row.likeCount,
    },
    {
      key: 'view_count',
      header: <span className="whitespace-nowrap">조회</span>,
      sortKey: 'view_count',
      align: 'right',
      className: 'w-20',
      cell: (row) => row.viewCount,
    },
    {
      key: 'created_at',
      header: <span className="whitespace-nowrap">작성일</span>,
      sortKey: 'created_at',
      className: 'w-36 whitespace-nowrap',
      cell: (row) => <span className="text-muted">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      className: 'w-[124px]',
      cell: (row) => (
        <ModerationActions
          kind="post"
          id={row.id}
          isHidden={row.isHidden}
          isDeleted={row.deletedAt !== null}
          canWrite={canWrite}
        />
      ),
    },
  ]
  const columns = columnDefs.filter((column): column is Column<PostListItem> => column !== null)

  return (
    <>
      <PageHeader
        title="커뮤니티 게시글"
        description={`총 ${list.count.toLocaleString('ko-KR')}건. 숨김·삭제는 사용자 사이트에 즉시 반영됩니다.`}
      />

      <ContentFilters pathname={PATH} params={searchParams} categories={categories} />

      {list.hasError && (
        <div className="mb-3">
          <FormBanner message={LIST_LOAD_ERROR} />
        </div>
      )}

      <Card>
        {canWrite && <BulkHideBar action={bulkHidePostsAction} label="게시글" />}
        <Table
          columns={columns}
          rows={list.rows}
          getRowKey={(row) => row.id}
          sort={params.sort}
          buildSortHref={(key) => sortHref(PATH, searchParams, params.sort, key)}
          caption="커뮤니티 게시글 목록"
          emptyMessage="조건에 맞는 게시글이 없습니다."
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
