import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { LEGAL_STATUS_LABEL, LEGAL_STATUS_TONE, legalClientPath } from '@/lib/constants/legal'
import { formatDateTime } from '@/lib/utils/format-date'
import { deriveLegalStatus } from '@/lib/validation/legal'
import { legalCurrentTerm } from '@/lib/validation/legal-state'

import type { LegalDocumentSummary } from '@/lib/data/legal'
import type { ReactNode } from 'react'

/**
 * 문서 카드 한 장.
 *
 * 버튼이 **상태를 따라간다**. 예전에는 상태와 무관하게 "편집" 하나였는데, 그 말은
 * 이어서 고칠 초안이 있는지, 지금 보는 것이 발행본인지 알려 주지 않는다. 초안이
 * 있으면 그것을 잇고, 없으면 발행본을 복사해 새 초안을 연다 — 발행본은 어차피
 * 고칠 수 없으므로 "편집"이라는 이름이 붙을 곳은 초안뿐이다.
 */

type LegalDocumentCardProps = {
  document: LegalDocumentSummary
  siteUrl: string
  /** 편집 화면(`/legal/[slug]`)은 쓰기 권한이 있어야 열린다. 버튼도 함께 감춘다. */
  canWrite: boolean
}

function href(slug: string, params: Record<string, string>): string {
  return `/legal/${slug}?${new URLSearchParams(params).toString()}`
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{term}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  )
}

export function LegalDocumentCard({ document, siteUrl, canWrite }: LegalDocumentCardProps) {
  const { current, scheduled, drafts } = document.state
  const status = current === null ? null : deriveLegalStatus(current, current.version)
  const newestDraft = drafts[0]

  return (
    <Card>
      <CardHeader
        title={document.label}
        description={`/policy/${document.slug} · 개정본 ${document.versionCount}건`}
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
          <Row term={status === null ? '시행 중' : legalCurrentTerm(status)}>
            {current === null ? (
              '-'
            ) : (
              <>
                <span className="font-semibold">{current.version}</span> · {current.effectiveDate}
              </>
            )}
          </Row>

          {scheduled === null ? null : (
            <Row term="예약">
              <>
                <span className="font-semibold">{scheduled.version}</span> ·{' '}
                {scheduled.effectiveDate}
              </>
            </Row>
          )}

          <Row term="초안">
            {newestDraft === undefined ? (
              '없음'
            ) : (
              <>
                <span className="font-semibold">{drafts.length}건</span> · 최근{' '}
                {formatDateTime(newestDraft.createdAt)}
              </>
            )}
          </Row>
        </dl>

        <div className="border-line flex flex-wrap items-center gap-2 border-t pt-3">
          {canWrite && (
            <>
              {newestDraft === undefined ? (
                <Button
                  href={href(document.slug, { from: current?.id ?? 'new' })}
                  size="sm"
                  data-testid="legal-card-primary"
                >
                  새 초안 만들기
                </Button>
              ) : (
                <Button
                  href={href(document.slug, { version: newestDraft.id })}
                  size="sm"
                  data-testid="legal-card-primary"
                >
                  초안 이어서 편집
                </Button>
              )}

              {current === null ? null : (
                <Button
                  href={href(document.slug, { version: current.id })}
                  variant="secondary"
                  size="sm"
                >
                  현재 발행본 보기
                </Button>
              )}

              <Button href={href(document.slug, { tab: 'history' })} variant="secondary" size="sm">
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
