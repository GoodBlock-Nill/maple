import Image from 'next/image'

import { gachaDetailIcon, GACHA_GRADE_CLASS, GACHA_TABLE_COLUMNS } from '@/lib/constants/guide'
import { cn } from '@/lib/utils/cn'

import type { GachaRow } from '@/types/domain'

type GachaGradeTableProps = {
  rows: readonly GachaRow[]
  /** 표를 설명하는 접근성 캡션(아이템명). */
  caption: string
}

/**
 * 상세 모달의 확률 표. 헤더 h48(`#f3f3f3`) + 본문 h52, 행 사이 파선.
 * 좁은 화면에서는 가로 스크롤한다.
 */
export function GachaGradeTable({ rows, caption }: GachaGradeTableProps) {
  return (
    <div className="rounded-panel shadow-chip overflow-x-auto bg-white">
      <table className="w-full min-w-[640px] table-fixed border-collapse text-center">
        <caption className="sr-only">{caption} 등급별 획득 확률</caption>
        <colgroup>
          {GACHA_TABLE_COLUMNS.map((column) => (
            <col key={column.key} style={{ width: column.width }} />
          ))}
        </colgroup>
        <thead>
          <tr className="bg-[#f3f3f3]">
            {GACHA_TABLE_COLUMNS.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="text-table-head h-12 px-3 text-[16px] font-medium"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row.grade}-${row.itemName}-${index}`}
              className="gacha-table-row text-table-body h-[52px] text-[16px] font-medium"
            >
              <td className={cn('px-3 font-semibold', GACHA_GRADE_CLASS[row.grade])}>
                [{row.grade}등급]
              </td>
              <td className="px-3">
                <span className="inline-flex items-center gap-[5px]">
                  <Image
                    src={gachaDetailIcon(row.itemName, row.itemIcon)}
                    alt=""
                    width={32}
                    height={32}
                    aria-hidden
                    className="size-8 object-contain"
                  />
                  {row.itemName}
                </span>
              </td>
              <td className="px-3">{row.probability}%</td>
              <td className="px-3">{row.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
