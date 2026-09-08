import { Badge } from '@/components/ui/Badge'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import {
  POLICY_PROSE_CLASS,
  policyTocEntries,
  renderPolicyHtml,
} from '@/components/legal/legal-prose'
import { LEGAL_STATUS_LABEL, LEGAL_STATUS_TONE } from '@/lib/constants/legal'

import type { LegalVersionStatus } from '@/lib/constants/legal'

/**
 * 저장된 개정본을 **사용자 사이트가 그리는 대로** 보여 주는 미리보기.
 *
 * 클래스는 사용자 사이트 `components/policy/*` 에서 그대로 옮겼고, 색 토큰은
 * `.legal-preview` 안에서만 사용자 사이트 값으로 덮어쓴다(admin/app/globals.css).
 * 그래서 여기 보이는 것과 독자가 보는 것 사이에 틈이 없다.
 *
 * `dangerouslySetInnerHTML` 은 의도된 선택이다. 여기 오는 문자열은 저장 직전에
 * `sanitizeLegalHtml()` 을 통과한 값뿐이고, `renderPolicyHtml()` 은 앵커 id 와 표
 * 스크롤 상자만 덧붙인다 — 사용자 사이트의 `PolicyHtmlBody` 와 같은 계약이다.
 */

type LegalPreviewProps = {
  /** 사용자 사이트 `<h1>` 에 그려지는 이름(헤더 링크 라벨). */
  heading: string
  version: string
  /** `2026년 9월 18일` 표기. */
  effectiveDate: string
  contentHtml: string
  status: LegalVersionStatus
}

export function LegalPreview({
  heading,
  version,
  effectiveDate,
  contentHtml,
  status,
}: LegalPreviewProps) {
  const entries = policyTocEntries(contentHtml)

  return (
    <Card>
      <CardHeader
        title="클라이언트 미리보기"
        description="저장된 내용을 사용자 사이트와 같은 서식으로 그립니다. 편집 중인 내용은 저장해야 반영됩니다."
        action={<Badge tone={LEGAL_STATUS_TONE[status]}>{LEGAL_STATUS_LABEL[status]}</Badge>}
      />

      {/* legal-preview 안에서만 사용자 사이트의 본문 색(--color-ink)을 쓴다. */}
      <CardBody className="legal-preview bg-page-sub">
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8 py-8">
          <header className="flex flex-col gap-3">
            <h2 className="text-ink text-[clamp(28px,4vw,44px)] font-semibold">{heading}</h2>
            <div className="text-ink-muted flex flex-wrap items-center gap-3 text-[15px]">
              <span>시행일 {effectiveDate}</span>
              <span aria-hidden className="text-line-soft">
                ·
              </span>
              <span className="border-line-soft text-ink-muted rounded-pill border px-3 py-1 text-[13px]">
                버전 {version}
              </span>
            </div>
          </header>

          {entries.length === 0 ? null : (
            <nav
              aria-label="목차 미리보기"
              className="border-line-soft rounded-panel bg-surface border p-6"
            >
              <p className="text-ink text-[16px] font-semibold">목차</p>
              <ol className="mt-4 flex flex-col gap-2.5">
                {entries.map((entry) => (
                  <li key={entry.id} className="text-ink-muted text-[15px]">
                    {entry.label}
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <div className="rounded-panel border-line-soft bg-surface flex flex-col gap-12 border p-4 sm:p-10">
            <div
              className={POLICY_PROSE_CLASS}
              dangerouslySetInnerHTML={{ __html: renderPolicyHtml(contentHtml) }}
            />
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
