import { DeleteRoleButton } from '@/components/admins/DeleteRoleButton'
import { RoleFormDialog } from '@/components/admins/RoleFormDialog'
import { Badge } from '@/components/ui/Badge'
import { Table, type Column } from '@/components/ui/Table'
import { summarizePermissions } from '@/lib/auth/permissions'

import type { AdminRoleItem } from '@/lib/data/admins'

/**
 * 권한(역할) 목록.
 *
 * 권한 요약을 한 줄로 적는다(쓰기 n · 읽기 m). 모듈 13개를 전부 펼치면 표가
 * 읽히지 않고, 정확한 값은 수정 다이얼로그의 표가 보여 준다.
 */
export function RolesTable({ roles }: { roles: readonly AdminRoleItem[] }) {
  const columns: readonly Column<AdminRoleItem>[] = [
    {
      key: 'name',
      header: '이름',
      cell: (row) => (
        <span className="flex flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className="font-semibold">{row.name}</span>
            {row.isSystem && <Badge tone="accent">시스템</Badge>}
          </span>
          <code className="text-muted text-[12px]">{row.key}</code>
        </span>
      ),
    },
    {
      key: 'description',
      header: '설명',
      cell: (row) => <span className="text-muted">{row.description ?? '-'}</span>,
    },
    {
      key: 'permissions',
      header: '권한',
      className: 'w-32',
      cell: (row) => <span className="text-muted">{summarizePermissions(row.permissions)}</span>,
    },
    {
      key: 'members',
      header: '사용',
      align: 'right',
      className: 'w-20',
      cell: (row) => <span>{row.memberCount}명</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      className: 'w-44',
      cell: (row) => (
        <span className="flex items-center justify-end gap-1.5">
          {row.isSystem ? null : <RoleFormDialog role={row} />}
          <DeleteRoleButton
            roleId={row.id}
            name={row.name}
            isSystem={row.isSystem}
            memberCount={row.memberCount}
          />
        </span>
      ),
    },
  ]

  return (
    <Table
      columns={columns}
      rows={roles}
      getRowKey={(row) => row.id}
      caption="관리자 권한 목록"
      emptyMessage="역할이 없습니다."
    />
  )
}
