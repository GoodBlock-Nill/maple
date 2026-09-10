import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { hasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require-admin'
import { LEGAL_STATUS_LABEL, LEGAL_STATUS_TONE, legalClientPath } from '@/lib/constants/legal'
import { listLegalDocuments } from '@/lib/data/legal'
import { clientSiteUrl } from '@/lib/supabase/env'
import { formatDateTime } from '@/lib/utils/format-date'
import { deriveLegalStatus } from '@/lib/validation/legal'

import type { LegalDocumentSummary } from '@/lib/data/legal'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Legal',
}

export const dynamic = 'force-dynamic'

/**
 * 약관 문서 목록.
 *
 * 문서 수가 고정(현재 네 개)이라 표가 아니라 카드다. 거의 늘어나지 않는 목록에
 * 정렬·검색·페이지를 붙이면 운영자가 매번 같은 몇 줄을 훑게 된다. 카드 목록의
 * 단일 출처는 `LEGAL_DOCUMENTS` 이므로 문서를 더할 때 이 화면은 손대지 않는다.
 */
export default async function LegalPage() {
  const { permissions } = await requirePermission('legal', 'read')
  const canWrite = hasPermission(permissions, 'legal', 'write')
  const documents = await listLegalDocuments()
  const siteUrl = clientSiteUrl()

  return (
    <>
      <PageHeader
        title="Legal"
        description="개인정보처리방침 · 디스코드 운영정책 · 글자월드 운영정책 · 마케팅 정보 수신 동의. 발행본은 사용자 사이트 /policy/[slug] 가 그대로 읽습니다."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {documents.map((document) => (
          <LegalDocumentCard
            key={document.slug}
            document={document}
            siteUrl={siteUrl}
            canWrite={canWrite}
          />
        ))}
      </div>
    </>
  )
}

type LegalDocumentCardProps = {
  document: LegalDocumentSummary
  siteUrl: string
  /** 편집 화면(`/legal/[slug]`)은 쓰기 권한이 있어야 열린다. 버튼도 함께 감춘다. */
  canWrite: boolean
}

function LegalDocumentCard({ document, siteUrl, canWrite }: LegalDocumentCardProps) {
  const { current, latest } = document
  const status = current === null ? null : deriveLegalStatus(current, current.version)

  return (
    <Card>
      <CardHeader
        title={document.label}
        description={`/policy/${document.slug}`}
        action={
          status === null ? (
            <Badge tone="warn">미발행</Badge>
          ) : (
            <Badge tone={LEGAL_STATUS_TONE[status]}>{LEGAL_STATUS_LABEL[status]}</Badge>
          )
        }
      />
      <CardBody className="flex flex-col gap-4">
        <dl className="flex flex-col gap-2 text-[13px]">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">현재 발행 버전</dt>
            <dd className="text-ink font-semibold">{current?.version ?? '-'}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">시행일</dt>
            <dd className="text-ink">{current?.effectiveDate ?? '-'}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">마지막 수정</dt>
            <dd className="text-ink">{latest === null ? '-' : formatDateTime(latest.createdAt)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">개정본</dt>
            <dd className="text-ink">{document.versionCount}건</dd>
          </div>
        </dl>

        <div className="border-line flex flex-wrap items-center gap-2 border-t pt-3">
          {canWrite && (
            <>
              <Button href={`/legal/${document.slug}`} size="sm">
                편집
              </Button>
              <Button href={`/legal/${document.slug}#history`} variant="secondary" size="sm">
                버전 이력
              </Button>
            </>
          )}
          <a
            href={`${siteUrl}${legalClientPath(document.slug)}`}
            target="_blank"
            rel="noreferrer"
            className="text-accent-strong focus-visible:outline-focus rounded-sm text-[13px] font-semibold hover:underline focus-visible:outline-2"
          >
            클라이언트 ↗
          </a>
        </div>
      </CardBody>
    </Card>
  )
}
