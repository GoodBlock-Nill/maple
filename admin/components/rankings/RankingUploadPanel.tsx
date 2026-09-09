'use client'

import { useActionState, useCallback, useState } from 'react'

import { RankingPreview } from '@/components/rankings/RankingPreview'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormBanner } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { applyRankingCsvAction } from '@/lib/actions/rankings-actions'
import { toCsvFile } from '@/lib/utils/csv'
import {
  rankTypeLabel,
  RANKING_CSV_HEADERS,
  validateRankingCsv,
  type RankingCsvPreview,
  type RankType,
} from '@/lib/validation/rankings'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 랭킹 CSV 업로드 — 파일 → 미리보기 → 적용.
 *
 * 랭킹은 행 단위로 고치지 않고 스냅샷을 통째로 갈아 끼운다. 그래서 미리보기가
 * 마지막 방어선이다 — 순위가 하나 빠진 표를 올리면 사용자 사이트의 랭킹이 그대로
 * 틀린다. 검증은 서버와 **같은 함수**(validateRankingCsv)로 한다.
 *
 * 적용은 확인 다이얼로그를 한 번 거친다. 미리보기를 스쳐 지나가고 버튼을 누르는
 * 일이 잦은데, 이 버튼 하나가 사용자 사이트의 랭킹 표를 통째로 갈아 끼운다.
 */
export function RankingUploadPanel({ rankType }: { rankType: RankType }) {
  const [preview, setPreview] = useState<
    (RankingCsvPreview & { fileName: string; csv: string }) | null
  >(null)
  const [isConfirmOpen, setConfirmOpen] = useState(false)
  const { showToast } = useToast()

  const runApply = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await applyRankingCsvAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        setPreview(null)
        setConfirmOpen(false)
      }

      return result
    },
    [showToast],
  )

  const [state, formAction, isPending] = useActionState(runApply, EMPTY_FORM_STATE)

  const onFile = useCallback(async (file: File) => {
    const csv = await file.text()

    setPreview({ ...validateRankingCsv(csv), fileName: file.name, csv })
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <FormBanner message={state.formError} />

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".csv,text/csv"
          aria-label="랭킹 CSV 파일"
          data-testid="ranking-csv-input"
          onChange={(event) => {
            const file = event.target.files?.[0]

            if (file !== undefined) {
              void onFile(file)
            }
          }}
          className="text-ink text-[13px]"
        />
        <Button size="sm" variant="secondary" onClick={downloadTemplate}>
          템플릿 내려받기
        </Button>
      </div>

      {preview !== null && (
        <>
          <p className="text-muted text-[13px]" data-testid="ranking-import-summary">
            {preview.fileName} — {rankTypeLabel(rankType)} · 유효 {preview.rows.length}건 · 오류{' '}
            {preview.issues.length}건
          </p>

          {preview.issues.length > 0 && (
            <ul className="border-danger/20 bg-danger-soft text-danger rounded-panel flex flex-col gap-1 border px-3 py-2 text-[13px]">
              {preview.issues.slice(0, 10).map((issue, index) => (
                <li key={index}>
                  {issue.line === 0 ? '파일' : `${issue.line}번째 줄`}: {issue.message}
                </li>
              ))}
              {preview.issues.length > 10 && <li>외 {preview.issues.length - 10}건</li>}
            </ul>
          )}

          {preview.rows.length > 0 && <RankingPreview rows={preview.rows} />}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPreview(null)} disabled={isPending}>
              취소
            </Button>
            <Button disabled={!preview.isValid || isPending} onClick={() => setConfirmOpen(true)}>
              {`적용 (${preview.rows.length}건)`}
            </Button>
          </div>

          <Dialog
            open={isConfirmOpen}
            onClose={() => setConfirmOpen(false)}
            title="랭킹 적용"
            description={`${rankTypeLabel(rankType)} 랭킹을 ${preview.rows.length}건으로 교체합니다. 사용자 사이트에 즉시 반영되며 기존 스냅샷은 이력에 남아 되돌릴 수 있습니다.`}
          >
            <form action={formAction} className="flex flex-col gap-4">
              <input type="hidden" name="csv" value={preview.csv} readOnly />
              <input type="hidden" name="rankType" value={rankType} readOnly />

              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setConfirmOpen(false)}
                  disabled={isPending}
                >
                  취소
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? '적용 중…' : '적용'}
                </Button>
              </div>
            </form>
          </Dialog>
        </>
      )}
    </div>
  )
}

/** 템플릿의 예시 한 줄. 열 이름만 준 파일은 "무엇을 어떻게 적어야 하는지"를 못 알려 준다. */
const SAMPLE_ROW = ['1', '설윤', '212', '비숍', 'adventurer', 'MapleStar', '98.7B', '']

/** 헤더 + 예시 1행. 열 이름과 순서를 눈으로 확인하고 시작하게 한다. */
function downloadTemplate(): void {
  const blob = new Blob([toCsvFile([[...RANKING_CSV_HEADERS], SAMPLE_ROW])], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = 'ranking-template.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}
