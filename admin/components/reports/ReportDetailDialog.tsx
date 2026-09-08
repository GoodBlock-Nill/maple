'use client'

import { useState } from 'react'

import { ReportDismissForm } from '@/components/reports/ReportDismissForm'
import { ReportResolveForm } from '@/components/reports/ReportResolveForm'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { cn } from '@/lib/utils/cn'
import { formatDateTime } from '@/lib/utils/format-date'
import {
  REPORT_REASON_LABEL,
  REPORT_STATUS_LABEL,
  REPORT_TARGET_LABEL,
} from '@/lib/validation/moderation'

import type { ReportItem } from '@/lib/data/reports'

/**
 * 신고 상세 + 처리/기각.
 *
 * 목록이 이미 대상 본문과 이력을 함께 읽어 두므로(lib/data/reports.ts) 다이얼로그는
 * 열릴 때 추가 요청을 하지 않는다. 판단에 필요한 정보가 한 화면에 있어야
 * 운영자가 탭을 오가며 맥락을 잃지 않는다.
 */
export function ReportDetailDialog({
  report,
  previewHref,
  authorHref,
}: {
  report: ReportItem
  previewHref: string | null
  authorHref: string | null
}) {
  const [isOpen, setOpen] = useState(false)
  const [mode, setMode] = useState<'resolve' | 'dismiss'>('resolve')
  const target = report.target

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {report.status === 'open' ? '처리' : '상세'}
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => setOpen(false)}
        title="신고 상세"
        description={`${REPORT_TARGET_LABEL[report.targetType]} · ${REPORT_REASON_LABEL[report.reason]} · ${formatDateTime(report.createdAt)}`}
      >
        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
          <section className="border-line bg-page/60 rounded-panel flex flex-col gap-2 border px-3 py-3">
            <header className="flex flex-wrap items-center gap-1.5">
              <Badge tone="accent">{REPORT_TARGET_LABEL[report.targetType]}</Badge>
              {target === null ? (
                <Badge tone="danger">대상 없음</Badge>
              ) : (
                <>
                  {target.isHidden && <Badge tone="warn">숨김</Badge>}
                  {target.deletedAt !== null && <Badge tone="danger">삭제</Badge>}
                  <span className="text-muted text-[12px]">작성자 {target.authorName}</span>
                </>
              )}
            </header>

            {/* 게시글은 제목이 판단의 절반이다. 본문만 띄우면 목록에서 본 행과 같은
                글인지 확인할 수 없다(댓글은 제목이 없어 발췌 = 본문이라 생략한다). */}
            {report.targetType === 'post' && target !== null && (
              <p className="text-ink text-[14px] font-bold">{target.excerpt}</p>
            )}

            <p className="text-ink max-h-40 overflow-y-auto text-[13px] leading-relaxed whitespace-pre-wrap">
              {target?.content ?? '대상을 찾을 수 없습니다(이미 완전히 삭제되었을 수 있습니다).'}
            </p>

            <div className="flex gap-2">
              {previewHref !== null && (
                <Button href={previewHref} target="_blank" rel="noreferrer" variant="ghost" size="sm">
                  원문 보기
                </Button>
              )}
              {authorHref !== null && (
                <Button href={authorHref} variant="ghost" size="sm">
                  작성자 보기
                </Button>
              )}
            </div>
          </section>

          <dl className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
            <dt className="text-muted">신고자</dt>
            <dd className="text-ink font-semibold">{report.reporterNickname}</dd>
            <dt className="text-muted">사유</dt>
            <dd className="text-ink">{REPORT_REASON_LABEL[report.reason]}</dd>
            <dt className="text-muted">상세</dt>
            <dd className="text-ink whitespace-pre-wrap">{report.detail ?? '-'}</dd>
            <dt className="text-muted">누적 신고</dt>
            <dd className="text-ink">{report.history.length}건</dd>
          </dl>

          {report.history.length > 1 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-ink text-[13px] font-semibold">같은 대상의 신고 이력</h3>
              <ul className="border-line divide-line divide-y rounded-panel border">
                {report.history.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-[12px]"
                  >
                    <span className="text-muted">
                      {formatDateTime(item.createdAt)} · {item.reporterNickname}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-ink">{REPORT_REASON_LABEL[item.reason]}</span>
                      <Badge tone={item.status === 'open' ? 'warn' : 'neutral'}>
                        {REPORT_STATUS_LABEL[item.status]}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="border-line flex gap-1 border-b">
            <ModeTab isActive={mode === 'resolve'} onClick={() => setMode('resolve')} label="처리" />
            <ModeTab isActive={mode === 'dismiss'} onClick={() => setMode('dismiss')} label="기각" />
          </div>

          {mode === 'resolve' ? (
            <ReportResolveForm
              reportId={report.id}
              openCountForTarget={report.openCountForTarget}
              onDone={() => setOpen(false)}
            />
          ) : (
            <ReportDismissForm
              reportId={report.id}
              openCountForTarget={report.openCountForTarget}
              onDone={() => setOpen(false)}
            />
          )}
        </div>
      </Dialog>
    </>
  )
}

function ModeTab({
  isActive,
  onClick,
  label,
}: {
  isActive: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        'focus-visible:outline-focus -mb-px border-b-2 px-3 py-1.5 text-[13px] font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2',
        isActive ? 'border-accent text-accent-strong' : 'text-muted hover:text-ink border-transparent',
      )}
    >
      {label}
    </button>
  )
}
