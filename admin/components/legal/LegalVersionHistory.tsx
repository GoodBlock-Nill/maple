import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import { LEGAL_STATUS_LABEL, LEGAL_STATUS_TONE, type LegalSlug } from '@/lib/constants/legal'
import { formatDateTime } from '@/lib/utils/format-date'
import { deriveLegalStatus } from '@/lib/validation/legal'

import type { LegalVersion } from '@/lib/data/legal'
import type { Column } from '@/components/ui/Table'

/**
 * 버전 이력.
 *
 * 화면 상태를 컴포넌트가 아니라 **쿼리스트링**에 적는다(`?version=` · `?base=`).
 * 자바스크립트 없이도 동작하고, 운영자가 "이 두 버전을 비교한 화면"을 그대로
 * 링크로 공유할 수 있다.
 */

type LegalVersionHistoryProps = {
  slug: LegalSlug
  versions: readonly LegalVersion[]
  /** 현재 시행 중인 버전 문자열. 상태 뱃지 판정에 쓴다. */
  currentVersion: string | null
  /** 지금 열려 있는 개정본 id. */
  selectedId: string
  /** 비교 기준으로 고른 개정본 id. 비어 있으면 비교하지 않는다. */
  baseId: string
}

function href(slug: LegalSlug, params: Record<string, string>): string {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== ''),
  ).toString()

  return query === '' ? `/legal/${slug}` : `/legal/${slug}?${query}`
}

export function LegalVersionHistory({
  slug,
  versions,
  currentVersion,
  selectedId,
  baseId,
}: LegalVersionHistoryProps) {
  const columns: readonly Column<LegalVersion>[] = [
    {
      key: 'version',
      header: '버전',
      cell: (row) => (
        <span className="text-ink font-semibold">
          {row.version}
          {row.id === selectedId ? <span className="text-accent-strong ml-1.5">·</span> : null}
        </span>
      ),
    },
    { key: 'effectiveDate', header: '시행일', cell: (row) => row.effectiveDate },
    {
      key: 'status',
      header: '상태',
      cell: (row) => {
        const status = deriveLegalStatus(row, currentVersion)

        return <Badge tone={LEGAL_STATUS_TONE[status]}>{LEGAL_STATUS_LABEL[status]}</Badge>
      },
    },
    {
      key: 'summary',
      header: '변경 요약',
      cell: (row) => <span className="text-muted">{row.summary === '' ? '-' : row.summary}</span>,
    },
    { key: 'createdAt', header: '만든 날짜', cell: (row) => formatDateTime(row.createdAt) },
    {
      key: 'actions',
      header: '동작',
      align: 'right',
      className: 'w-64',
      cell: (row) => (
        <span className="flex flex-wrap items-center justify-end gap-1.5">
          <Button href={href(slug, { version: row.id, base: baseId })} variant="ghost" size="sm">
            보기
          </Button>
          <Button href={href(slug, { from: row.id })} variant="ghost" size="sm">
            새 초안 만들기
          </Button>
          <Button
            href={href(slug, { version: selectedId, base: row.id })}
            variant="ghost"
            size="sm"
            aria-label={`${row.version} 과 비교`}
          >
            비교
          </Button>
        </span>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader
        title="버전 이력"
        description="발행한 개정본은 고치지 않고 새 버전을 쌓습니다. 분쟁 시점의 문안을 되짚을 수 있어야 하기 때문입니다."
        action={
          <Button href={href(slug, { from: 'new' })} variant="secondary" size="sm">
            빈 초안 만들기
          </Button>
        }
      />
      <CardBody className="px-0 py-0">
        <Table
          columns={columns}
          rows={versions}
          getRowKey={(row) => row.id}
          caption="약관 개정본 이력"
          emptyMessage="아직 개정본이 없습니다."
        />
      </CardBody>
    </Card>
  )
}
