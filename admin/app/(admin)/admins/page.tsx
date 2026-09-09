import { RevokeAdminButton } from '@/components/admins/RevokeAdminButton'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Table, type Column } from '@/components/ui/Table'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getAdmins, type AdminListItem } from '@/lib/data/admins'
import { formatDateTime } from '@/lib/utils/format-date'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '관리자',
}

export const dynamic = 'force-dynamic'

export default async function AdminsPage() {
  const [me, admins] = await Promise.all([requireAdmin(), getAdmins()])

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
    {
      key: 'email',
      header: '이메일',
      cell: (row) => <span className="text-muted">{row.email}</span>,
    },
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

  return (
    <>
      {/* 이메일 초대는 제품 결정(2026-09-09)으로 없앴다. 관리자는 사용자 사이트에 가입한
          회원을 회원 상세에서 승격해서만 만든다. 여기서는 목록과 회수만 다룬다. */}
      <PageHeader
        title="관리자"
        description="관리자 목록과 권한 회수. 새 관리자는 회원 상세의 '관리자 권한 부여'로 승격합니다."
      />

      <Card>
        <CardHeader title={`관리자 ${admins.length}명`} />
        <Table
          columns={adminColumns}
          rows={admins}
          getRowKey={(row) => row.id}
          caption="관리자 목록"
          emptyMessage="관리자가 없습니다."
        />
      </Card>
    </>
  )
}
