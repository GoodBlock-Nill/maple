import { InviteActions } from '@/components/admins/InviteActions'
import { Badge } from '@/components/ui/Badge'
import { Table, type Column } from '@/components/ui/Table'
import { formatDateTime } from '@/lib/utils/format-date'

import type { AdminInviteItem } from '@/lib/data/admins'

/**
 * 수락 대기 초대.
 *
 * 만료된 초대도 지우지 않고 표시한다 — 재발송 한 번이면 되살아나므로, 목록에서
 * 사라지면 운영자가 "초대를 보냈던가?"부터 다시 확인해야 한다.
 */
export function InvitesTable({ invites }: { invites: readonly AdminInviteItem[] }) {
  const columns: readonly Column<AdminInviteItem>[] = [
    {
      key: 'email',
      header: '이메일',
      cell: (row) => (
        <span className="flex items-center gap-2">
          <span className="font-semibold">{row.email}</span>
          {row.isExpired && <Badge tone="warn">만료</Badge>}
        </span>
      ),
    },
    {
      key: 'role',
      header: '권한',
      className: 'w-36',
      cell: (row) =>
        row.roleName === null ? (
          <span className="text-muted">-</span>
        ) : (
          <Badge tone="neutral">{row.roleName}</Badge>
        ),
    },
    {
      key: 'createdAt',
      header: '발송일',
      className: 'w-40',
      cell: (row) => <span className="text-muted">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'expiresAt',
      header: '만료',
      className: 'w-40',
      cell: (row) => (
        <span className="text-muted">
          {row.expiresAt === null ? '없음' : formatDateTime(row.expiresAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      className: 'w-40',
      cell: (row) => <InviteActions inviteId={row.id} email={row.email} />,
    },
  ]

  return (
    <Table
      columns={columns}
      rows={invites}
      getRowKey={(row) => row.id}
      caption="수락 대기 초대"
      emptyMessage="대기 중인 초대가 없습니다."
    />
  )
}
