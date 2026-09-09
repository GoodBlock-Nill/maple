import { AdminsTable } from '@/components/admins/AdminsTable'
import { InviteAdminDialog } from '@/components/admins/InviteAdminDialog'
import { InvitesTable } from '@/components/admins/InvitesTable'
import { RoleFormDialog } from '@/components/admins/RoleFormDialog'
import { RolesTable } from '@/components/admins/RolesTable'
import { Card, CardHeader } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { requireSuperAdmin } from '@/lib/auth/require-admin'
import { getAdminRoles, getAdmins, getPendingInvites } from '@/lib/data/admins'

import type { SelectOption } from '@/components/ui/Select'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '관리자',
}

export const dynamic = 'force-dynamic'

/**
 * 관리자 · 권한 관리 — **슈퍼어드민 전용**이다.
 *
 * `admins` 모듈 권한이 아니라 `requireSuperAdmin()` 으로 막는다. 권한 체계 자체를
 * 바꾸는 화면을 역할표로 위임할 수 있게 두면, 임의의 역할이 스스로를 슈퍼어드민으로
 * 올리는 경로가 생긴다. 권한이 없는 관리자는 대시보드로 되돌아가 사유를 본다.
 *
 * 관리자를 만드는 유일한 경로는 초대다(2026-09-09 제품 결정). 회원 상세의
 * "관리자 권한 부여"는 없앴다.
 */
export default async function AdminsPage() {
  const [me, admins, roles, invites] = await Promise.all([
    requireSuperAdmin(),
    getAdmins(),
    getAdminRoles(),
    getPendingInvites(),
  ])

  const roleOptions: readonly SelectOption[] = roles.map((role) => ({
    value: role.id,
    label: role.name,
  }))

  return (
    <>
      <PageHeader
        title="관리자"
        description="관리자 계정을 초대·삭제하고 권한(역할)을 관리합니다. 삭제는 계정을 지우지 않고 콘솔 로그인을 막습니다."
        action={<InviteAdminDialog roleOptions={roleOptions} />}
      />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader
            title={`관리자 ${admins.length}명`}
            description="역할을 바꾸면 다음 요청부터 사이드바와 화면 권한이 함께 바뀝니다."
          />
          <AdminsTable admins={admins} roleOptions={roleOptions} currentAdminId={me.id} />
        </Card>

        <Card>
          <CardHeader
            title={`수락 대기 초대 ${invites.length}건`}
            description="받은 사람이 링크에서 비밀번호를 정하면 관리자가 됩니다. 링크가 만료되면 재발송하세요."
          />
          <InvitesTable invites={invites} />
        </Card>

        <Card>
          <CardHeader
            title={`권한 ${roles.length}개`}
            description="모듈마다 없음 · 읽기 · 쓰기를 정합니다. 슈퍼어드민은 시스템 역할이라 바꿀 수 없습니다."
            action={<RoleFormDialog role={null} />}
          />
          <RolesTable roles={roles} />
        </Card>
      </div>
    </>
  )
}
