import { AuditFilters } from '@/components/audit/AuditFilters'
import { AuditTable } from '@/components/audit/AuditTable'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { requirePermission } from '@/lib/auth/require-admin'
import { AUDIT_PAGE_SIZE, getAuditFilterOptions, getAuditLogs } from '@/lib/data/audit'
import { buildHref, firstValue, parsePage, totalPages } from '@/lib/utils/table-query'

import type { AuditFilters as Filters } from '@/lib/data/audit'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '감사 로그',
}

export const dynamic = 'force-dynamic'

const PATH = '/audit'

export default async function AuditPage(props: PageProps<'/audit'>) {
  await requirePermission('audit', 'read')
  const searchParams = await props.searchParams

  const filters: Filters = {
    actorId: firstValue(searchParams.actor),
    targetTable: firstValue(searchParams.table),
    action: firstValue(searchParams.action),
    from: firstValue(searchParams.from),
    to: firstValue(searchParams.to),
    q: firstValue(searchParams.q),
    page: parsePage(searchParams.page),
  }

  const [{ items, count }, options] = await Promise.all([
    getAuditLogs(filters),
    getAuditFilterOptions(),
  ])

  return (
    <>
      <PageHeader
        title="감사 로그"
        description="관리자의 모든 변경 이력입니다. 추가 전용이라 수정·삭제할 수 없습니다."
      />

      <Card className="mb-6">
        <CardHeader title="필터" />
        <CardBody>
          <AuditFilters filters={filters} options={options} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={`기록 ${count}건`}
          description="요약을 눌러 펼치면 변경 전후 전체를 볼 수 있습니다. 비밀번호·토큰 값은 가려집니다."
        />
        <AuditTable items={items} />
        <Pagination
          page={filters.page}
          total={totalPages(count, AUDIT_PAGE_SIZE)}
          buildHref={(target) => buildHref(PATH, searchParams, { page: String(target) })}
        />
      </Card>
    </>
  )
}
