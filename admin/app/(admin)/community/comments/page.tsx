import { BulkHideBar, BulkSelectCheckbox } from '@/components/community/BulkHideBar'
import { CellLink, ContentFilters } from '@/components/community/ContentFilters'
import { ModerationActions } from '@/components/community/ModerationActions'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { FormBanner } from '@/components/ui/FormField'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { Table, type Column } from '@/components/ui/Table'
import { bulkHideCommentsAction } from '@/lib/actions/moderation-actions'
import { LIST_LOAD_ERROR } from '@/lib/constants/messages'
import {
  getCommunityComments,
  parseCommentListParams,
  type CommentListItem,
} from '@/lib/data/community'
import { clientSiteUrl } from '@/lib/supabase/env'
import { formatDateTime } from '@/lib/utils/format-date'
import { buildHref, DEFAULT_PAGE_SIZE, sortHref, totalPages } from '@/lib/utils/table-query'
import { contentStatus, CONTENT_STATUS_LABEL } from '@/lib/validation/moderation'

import type { BadgeTone } from '@/components/ui/Badge'
import type { ContentStatus } from '@/lib/validation/moderation'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '커뮤니티 댓글',
}

export const dynamic = 'force-dynamic'

const PATH = '/community/comments'

const STATUS_TONE: Record<ContentStatus, BadgeTone> = {
  visible: 'success',
  hidden: 'warn',
  deleted: 'danger',
}

export default async function CommunityCommentsPage(props: PageProps<'/community/comments'>) {
  const searchParams = await props.searchParams
  const params = parseCommentListParams(searchParams)
  const list = await getCommunityComments(params)

  const columns: readonly Column<CommentListItem>[] = [
    {
      key: 'select',
      header: <span className="sr-only">선택</span>,
      className: 'w-10',
      align: 'center',
      cell: (row) => (
        <BulkSelectCheckbox
          id={row.id}
          label={row.content.slice(0, 20)}
          disabled={row.isHidden || row.deletedAt !== null}
        />
      ),
    },
    {
      key: 'content',
      header: '내용',
      cell: (row) => (
        <span className="line-clamp-2 whitespace-pre-wrap" title={row.content}>
          {row.content}
        </span>
      ),
    },
    {
      key: 'post',
      header: <span className="whitespace-nowrap">게시글</span>,
      className: 'w-44',
      /* 관리자에는 게시글 상세 화면이 없다. 원문(사용자 사이트)으로 보낸다. */
      cell: (row) => (
        <CellLink href={`${clientSiteUrl()}/community/${row.postId}`} external>
          <span className="line-clamp-1" title={row.postTitle}>
            {row.postTitle}
          </span>
        </CellLink>
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
      key: 'status',
      header: '상태',
      className: 'w-20',
      cell: (row) => {
        const status = contentStatus(row)

        return <Badge tone={STATUS_TONE[status]}>{CONTENT_STATUS_LABEL[status]}</Badge>
      },
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
      /* 댓글에는 자체 주소가 없다. 미리보기는 "게시글" 칸의 원문 링크가 맡는다. */
      cell: (row) => (
        <ModerationActions
          kind="comment"
          id={row.id}
          isHidden={row.isHidden}
          isDeleted={row.deletedAt !== null}
        />
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="커뮤니티 댓글"
        description={`총 ${list.count.toLocaleString('ko-KR')}건. 숨긴 댓글은 작성자에게도 보이지 않습니다.`}
      />

      <ContentFilters pathname={PATH} params={searchParams} />

      {list.hasError && (
        <div className="mb-3">
          <FormBanner message={LIST_LOAD_ERROR} />
        </div>
      )}

      <Card>
        <BulkHideBar action={bulkHideCommentsAction} label="댓글" />
        <Table
          columns={columns}
          rows={list.rows}
          getRowKey={(row) => row.id}
          sort={params.sort}
          buildSortHref={(key) => sortHref(PATH, searchParams, params.sort, key)}
          caption="커뮤니티 댓글 목록"
          emptyMessage="조건에 맞는 댓글이 없습니다."
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
