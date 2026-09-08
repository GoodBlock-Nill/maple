import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
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
 * 문서가 세 개로 고정이라 표가 아니라 카드 세 장이다. 늘어나지 않는 목록에
 * 정렬·검색·페이지를 붙이면 운영자가 매번 같은 세 줄을 훑게 된다.
 */
export default async function LegalPage() {
  const documents = await listLegalDocuments()
  const siteUrl = clientSiteUrl()

  return (
    <>
      <PageHeader
        title="Legal"
        description="개인정보처리방침 · 디스코드 운영정책 · 글자월드 운영정책. 발행본은 사용자 사이트 /policy/[slug] 가 그대로 읽습니다."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {documents.map((document) => (
          <LegalDocumentCard key={document.slug} document={document} siteUrl={siteUrl} />
        ))}
      </div>
    </>
  )
}

type LegalDocumentCardProps = {
  document: LegalDocumentSummary
  siteUrl: string
}

function LegalDocumentCard({ document, siteUrl }: LegalDocumentCardProps) {
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
            <dd className="text-ink">
              {latest === null ? '-' : formatDateTime(latest.createdAt)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">개정본</dt>
            <dd className="text-ink">{document.versionCount}건</dd>
          </div>
        </dl>

        <div className="border-line flex flex-wrap items-center gap-2 border-t pt-3">
          <Button href={`/legal/${document.slug}`} size="sm">
            편집
          </Button>
          <Button href={`/legal/${document.slug}#history`} variant="secondary" size="sm">
            버전 이력
          </Button>
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
