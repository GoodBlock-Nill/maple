import { InviteAdminDialog } from '@/components/admins/InviteAdminDialog'
import { RevokeAdminButton } from '@/components/admins/RevokeAdminButton'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Table, type Column } from '@/components/ui/Table'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getAdmins, getPendingInvites, type AdminListItem, type InviteListItem } from '@/lib/data/admins'
import { formatDateTime } from '@/lib/utils/format-date'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '관리자',
}

export const dynamic = 'force-dynamic'

export default async function AdminsPage() {
  const [me, admins, invites] = await Promise.all([requireAdmin(), getAdmins(), getPendingInvites()])

  const adminColumns: readonly Column<AdminListItem>[] = [
    {
      key: 'nickname',
      header: '닉네임',
      cell: (row) => (
        <span className="flex items-center gap-2">
          <span className="font-semibold">{row.nickname}</span>
          {row.id === me.id && <Badge tone="accent">나</Badge>}
        </span>
      ),
    },
    { key: 'email', header: '이메일', cell: (row) => <span className="text-muted">{row.email}</span> },
    {
      key: 'createdAt',
      header: '등록일',
      className: 'w-44',
      cell: (row) => <span className="text-muted">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      className: 'w-28',
      cell: (row) => (
        <RevokeAdminButton adminId={row.id} nickname={row.nickname} isSelf={row.id === me.id} />
      ),
    },
  ]

  const inviteColumns: readonly Column<InviteListItem>[] = [
    { key: 'email', header: '이메일', cell: (row) => row.email },
    {
      key: 'status',
      header: '상태',
      className: 'w-28',
      cell: () => <Badge tone="warn">수락 대기</Badge>,
    },
    {
      key: 'createdAt',
      header: '발송일',
      className: 'w-44',
      cell: (row) => <span className="text-muted">{formatDateTime(row.createdAt)}</span>,
    },
  ]

  return (
    <>
      <PageHeader
        title="관리자"
        description="관리자 계정을 초대하고 권한을 회수합니다."
        action={<InviteAdminDialog />}
      />

      <Card className="mb-6">
        <CardHeader title={`관리자 ${admins.length}명`} />
        <Table
          columns={adminColumns}
          rows={admins}
          getRowKey={(row) => row.id}
          caption="관리자 목록"
          emptyMessage="관리자가 없습니다."
        />
      </Card>

      <Card>
        <CardHeader
          title="수락 대기 초대"
          description="초대 메일을 보냈지만 아직 비밀번호를 설정하지 않은 계정입니다."
        />
        <Table
          columns={inviteColumns}
          rows={invites}
          getRowKey={(row) => row.id}
          caption="수락 대기 초대 목록"
          emptyMessage="대기 중인 초대가 없습니다."
        />
      </Card>
    </>
  )
}
