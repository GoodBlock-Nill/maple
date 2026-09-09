import type { GachaPreviewRow } from '@/components/gacha/gacha-preview-row'

/**
 * CSV 미리보기 표.
 *
 * 각 행의 검증 결과를 값 옆에 바로 붙인다 — 오류 목록을 따로 두면 운영자가
 * "몇 번째 줄"을 세어 가며 원본 파일과 대조해야 한다.
 */
export function GachaImportPreviewTable({ rows }: { rows: readonly GachaPreviewRow[] }) {
  return (
    <div className="border-line rounded-panel max-h-[420px] overflow-auto border">
      <table className="w-full min-w-[720px] border-collapse text-[13px]">
        <thead className="bg-page/70 sticky top-0">
          <tr className="border-line border-b">
            <th className="text-muted w-16 px-3 py-2 text-left text-[12px] font-semibold">줄</th>
            <th className="text-muted px-3 py-2 text-left text-[12px] font-semibold">탭</th>
            <th className="text-muted px-3 py-2 text-left text-[12px] font-semibold">이름</th>
            <th className="text-muted px-3 py-2 text-right text-[12px] font-semibold">확률</th>
            <th className="text-muted px-3 py-2 text-left text-[12px] font-semibold">검증</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.line} className="border-line border-b last:border-b-0">
              <td className="text-muted px-3 py-2">{row.line}</td>
              <td className="px-3 py-2">{row.values.tab}</td>
              <td className="px-3 py-2">{row.values.name}</td>
              <td className="px-3 py-2 text-right">{row.values.probability}</td>
              <td
                className={row.error === null ? 'text-success px-3 py-2' : 'text-danger px-3 py-2'}
              >
                {row.error ?? '정상'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
