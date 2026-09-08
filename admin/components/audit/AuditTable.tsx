import Link from 'next/link'

import { formatAuditJson, summarizeAuditDiff } from '@/components/audit/audit-diff'
import { auditActionLabel, auditTableLabel } from '@/components/audit/audit-labels'
import { auditTargetHref } from '@/lib/data/audit'
import { formatDateTime } from '@/lib/utils/format-date'

import type { AuditLogItem } from '@/lib/data/audit'

/**
 * 감사 로그 표.
 *
 * 공용 `<Table>` 을 쓰지 않는다. 한 로그가 **두 개의 `<tr>`**(요약 줄 + 펼침 줄)로
 * 그려져야 하는데 공용 표는 행 하나에 셀 배열만 그린다.
 *
 * 펼침은 `<details>` 로 만든다. 상태를 클라이언트로 내리지 않아도 되고, 자바스크립트
 * 없이 동작하며, 스크린 리더가 열림/닫힘을 그대로 읽는다.
 */
export function AuditTable({ items }: { items: readonly AuditLogItem[] }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-[13px]">
        <caption className="sr-only">감사 로그 목록</caption>
        <thead>
          <tr className="border-line bg-page/60 border-b">
            {['시각', '관리자', '행동', '대상', '변경 요약'].map((header) => (
              <th
                key={header}
                scope="col"
                className="text-muted px-4 py-2.5 text-left text-[12px] font-semibold"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-muted px-4 py-12 text-center">
                조건에 맞는 기록이 없습니다.
              </td>
            </tr>
          ) : (
            items.map((item) => <AuditRow key={item.id} item={item} />)
          )}
        </tbody>
      </table>
    </div>
  )
}

function AuditRow({ item }: { item: AuditLogItem }) {
  const href = auditTargetHref(item.targetTable, item.targetId)

  return (
    <>
      <tr className="border-line border-b align-top">
        <td className="text-muted w-40 px-4 py-3 whitespace-nowrap">
          {formatDateTime(item.createdAt)}
        </td>
        <td className="w-48 px-4 py-3">
          <span className="flex flex-col gap-0.5">
            <span className="text-ink font-semibold">{item.actorName}</span>
            {item.actorEmail !== null && (
              <span className="text-muted text-[12px]">{item.actorEmail}</span>
            )}
          </span>
        </td>
        <td className="text-ink w-44 px-4 py-3">{auditActionLabel(item.action)}</td>
        <td className="w-56 px-4 py-3">
          <span className="flex flex-col gap-0.5">
            <span className="text-ink">{auditTableLabel(item.targetTable)}</span>
            {item.targetId !== null &&
              (href === null ? (
                <span className="text-muted truncate text-[12px]">{item.targetId}</span>
              ) : (
                <Link
                  href={href}
                  className="text-accent-strong focus-visible:outline-focus truncate rounded-sm text-[12px] hover:underline focus-visible:outline-2"
                >
                  {item.targetId}
                </Link>
              ))}
          </span>
        </td>
        <td className="px-4 py-3">
          <details className="group">
            <summary className="text-ink marker:text-muted cursor-pointer list-outside">
              {summarizeAuditDiff(item.before, item.after)}
              <span className="text-muted ml-2 text-[12px] group-open:hidden">자세히</span>
            </summary>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <JsonBlock title="변경 전" value={formatAuditJson(item.before)} />
              <JsonBlock title="변경 후" value={formatAuditJson(item.after)} />
            </div>
          </details>
        </td>
      </tr>
    </>
  )
}

/** 비밀번호·토큰류는 `formatAuditJson` 이 이미 가린 뒤 들어온다. */
function JsonBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-muted text-[12px] font-semibold">{title}</p>
      <pre className="border-line bg-page rounded-panel text-ink max-h-72 overflow-auto border px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap">
        {value}
      </pre>
    </div>
  )
}
