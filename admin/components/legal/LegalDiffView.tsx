import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { diffLines, htmlToDiffLines, summarizeDiff } from '@/components/legal/version-diff'

import type { DiffKind } from '@/components/legal/version-diff'

/**
 * 두 개정본의 줄 단위 비교.
 *
 * 태그가 아니라 문장을 비교한다(`version-diff.ts`). 운영자가 알고 싶은 것은
 * "어떤 문장이 바뀌었나"이고, HTML 을 그대로 비교하면 표 한 칸이 바뀔 때마다
 * 문서 전체가 달라 보인다.
 */

/* 색만으로 구분하지 않는다. 기호(+/−)를 함께 두어야 색각 이상에서도 읽힌다. */
const KIND_CLASS: Record<DiffKind, string> = {
  same: 'text-muted',
  added: 'bg-success-soft text-success',
  removed: 'bg-danger-soft text-danger line-through',
}

const KIND_MARK: Record<DiffKind, string> = {
  same: ' ',
  added: '+',
  removed: '−',
}

type LegalDiffViewProps = {
  baseLabel: string
  targetLabel: string
  baseHtml: string
  targetHtml: string
}

export function LegalDiffView({
  baseLabel,
  targetLabel,
  baseHtml,
  targetHtml,
}: LegalDiffViewProps) {
  const lines = diffLines(htmlToDiffLines(baseHtml), htmlToDiffLines(targetHtml))
  const { added, removed } = summarizeDiff(lines)

  return (
    <Card>
      <CardHeader
        title={`${baseLabel} → ${targetLabel} 비교`}
        description={`추가 ${added}줄 · 삭제 ${removed}줄. 문단·목록 항목·표의 한 행을 각각 한 줄로 봅니다.`}
      />
      <CardBody className="max-h-[520px] overflow-y-auto">
        {added === 0 && removed === 0 ? (
          <p className="text-muted text-[13px]">두 버전의 문안이 같습니다.</p>
        ) : (
          <ol className="flex flex-col">
            {lines.map((line, index) => (
              <li
                key={`${index}-${line.text.slice(0, 24)}`}
                className={`rounded-panel px-2 py-0.5 font-mono text-[12px] leading-[1.7] ${KIND_CLASS[line.kind]}`}
              >
                <span aria-hidden className="mr-2 inline-block w-3 font-bold">
                  {KIND_MARK[line.kind]}
                </span>
                {line.text}
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  )
}
