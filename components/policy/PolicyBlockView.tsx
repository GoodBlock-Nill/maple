import { PolicyInlineText } from '@/components/policy/PolicyInlineText'

import type { PolicyBlock } from '@/lib/content/operating-policy'

type PolicyBlockViewProps = {
  block: PolicyBlock
}

/** 문단/목록/표 블록 하나를 그린다. */
export function PolicyBlockView({ block }: PolicyBlockViewProps) {
  if (block.kind === 'paragraph') {
    return (
      <p className="text-ink-muted text-[17px] leading-[1.8]">
        {block.code !== undefined ? (
          <strong className="text-ink mr-1.5 font-semibold">{block.code}</strong>
        ) : null}
        <PolicyInlineText text={block.text} />
      </p>
    )
  }

  if (block.kind === 'list') {
    return (
      <div className="flex flex-col gap-2">
        {block.intro !== undefined ? (
          <p className="text-ink-muted text-[17px] leading-[1.8]">
            <PolicyInlineText text={block.intro} />
          </p>
        ) : null}
        <ul className="flex flex-col gap-1.5 pl-1">
          {block.items.map((item) => (
            <li
              key={item}
              className="text-ink-muted marker:text-line-soft list-disc pl-1 text-[17px] leading-[1.8] marker:content-['–_']"
            >
              <PolicyInlineText text={item} />
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {block.code !== undefined || block.caption !== undefined ? (
        <p className="text-ink-muted text-[15px] leading-[1.8]">
          {block.code !== undefined ? (
            <strong className="text-ink mr-1.5 font-semibold">{block.code}</strong>
          ) : null}
          {block.caption}
        </p>
      ) : null}
      <div className="border-line-soft rounded-panel overflow-x-auto border">
        <table className="w-full min-w-[480px] border-collapse text-center">
          <thead>
            <tr className="bg-page-sub">
              {block.headers.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="text-table-head border-table-line h-11 border-b px-3 text-[14px] font-medium whitespace-nowrap"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="text-table-body h-12 text-[14px]">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="border-table-line border-t px-3 whitespace-nowrap">
                    <PolicyInlineText text={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
