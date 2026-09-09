import { AdminRoleSelect } from '@/components/admins/AdminRoleSelect'
import { DeleteAdminButton } from '@/components/admins/DeleteAdminButton'
import { Badge } from '@/components/ui/Badge'
import { Table, type Column } from '@/components/ui/Table'
import { formatDateTime } from '@/lib/utils/format-date'

import type { SelectOption } from '@/components/ui/Select'
import type { AdminListItem } from '@/lib/data/admins'

/**
 * 관리자 목록.
 *
 * 마지막 로그인 시각은 넣지 않는다 — `auth.users` 에만 있어 서비스 롤로 전 계정을
 * 훑어야 하는데, 목록 한 줄을 채우자고 RLS 밖의 조회 경로를 여는 것은 남는 장사가
 * 아니다. 필요해지면 감사 로그(`/audit`)가 더 정확한 이력을 준다.
 */
export function AdminsTable({
  admins,
  roleOptions,
  currentAdminId,
}: {
  admins: readonly AdminListItem[]
  roleOptions: readonly SelectOption[]
  currentAdminId: string
}) {
  const columns: readonly Column<AdminListItem>[] = [
    {
      key: 'nickname',
      header: '닉네임',
      cell: (row) => (
        <span className="flex items-center gap-2">
          <span className="font-semibold">{row.nickname}</span>
          {row.id === currentAdminId && <Badge tone="accent">나</Badge>}
        </span>
      ),
    },
    {
      key: 'email',
      header: '이메일',
      cell: (row) => <span className="text-muted">{row.email}</span>,
    },
    {
      key: 'role',
      header: '권한',
      className: 'w-36',
      cell: (row) =>
        row.roleName === null ? (
          <Badge tone="warn">역할 없음</Badge>
        ) : (
          <Badge tone={row.isSuperAdmin ? 'accent' : 'neutral'}>{row.roleName}</Badge>
        ),
    },
    {
      key: 'createdAt',
      header: '등록일',
      className: 'w-40',
      cell: (row) => <span className="text-muted">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'change',
      header: '역할 변경',
      className: 'w-[250px]',
      cell: (row) => (
        <AdminRoleSelect
          adminId={row.id}
          currentRoleId={row.roleId}
          roleOptions={roleOptions}
          isSelf={row.id === currentAdminId}
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      className: 'w-24',
      cell: (row) => (
        <DeleteAdminButton
          adminId={row.id}
          nickname={row.nickname}
          isSelf={row.id === currentAdminId}
        />
      ),
    },
  ]

  return (
    <Table
      columns={columns}
      rows={admins}
      getRowKey={(row) => row.id}
      caption="관리자 목록"
      emptyMessage="관리자가 없습니다."
    />
  )
}
