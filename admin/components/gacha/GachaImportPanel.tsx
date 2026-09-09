'use client'

import { useActionState, useCallback, useState } from 'react'

import { GachaImportPreviewTable } from '@/components/gacha/GachaImportPreviewTable'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormBanner } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { importGachaCsvAction } from '@/lib/actions/gacha-actions'
import { parseCsvTable, toCsvFile } from '@/lib/utils/csv'
import {
  gachaCsvRowSchema,
  GACHA_CSV_HEADERS,
  GACHA_CSV_REQUIRED_HEADERS,
} from '@/lib/validation/gacha'

import type { GachaPreviewRow } from '@/components/gacha/gacha-preview-row'
import type { FormState } from '@/lib/actions/form-state'

/**
 * CSV 가져오기 — 업로드 → 미리보기 → 적용.
 *
 * 미리보기는 브라우저에서 **서버와 같은 스키마**로 검사한다(lib/validation/gacha).
 * 그래도 적용 시에는 원본 텍스트를 통째로 서버에 보내 다시 검증한다 — 미리보기는
 * 사용자를 돕기 위한 것이지 신뢰 경계가 아니다.
 *
 * 적용 전에 확인을 한 번 받는다. 이름이 같은 기존 항목을 덮어쓰는 조작이고,
 * 확률 공시는 법적 고지라 잘못 덮어쓴 값이 그대로 사용자 사이트에 걸린다.
 */

type Preview = {
  fileName: string
  csv: string
  rows: readonly GachaPreviewRow[]
  fileError: string | null
}

const SAMPLE_ROW = [
  '',
  'premium',
  '프리미엄 부화기 12차',
  '/images/guide/icon-item-1.png',
  '1.234',
  'true',
  '',
  '[{"grade":"SS","itemName":"경험치 2배 쿠폰","itemIcon":"","probability":"0.05","note":"-"}]',
]

export function GachaImportPanel({ tab }: { tab: string }) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [isConfirmOpen, setConfirmOpen] = useState(false)
  const { showToast } = useToast()

  const runImport = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await importGachaCsvAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        setPreview(null)
        setConfirmOpen(false)
      }

      return result
    },
    [showToast],
  )

  const [state, formAction, isPending] = useActionState(runImport, EMPTY_FORM_STATE)

  const onFile = useCallback(async (file: File) => {
    const csv = await file.text()
    const table = parseCsvTable(csv, GACHA_CSV_REQUIRED_HEADERS)

    if (table.error !== null) {
      setPreview({ fileName: file.name, csv, rows: [], fileError: table.error })

      return
    }

    setPreview({
      fileName: file.name,
      csv,
      fileError: null,
      rows: table.records.map((record) => {
        const parsed = gachaCsvRowSchema.safeParse(record.values)

        return {
          line: record.line,
          values: record.values,
          error: parsed.success
            ? null
            : (parsed.error.issues[0]?.message ?? '값이 올바르지 않습니다.'),
        }
      }),
    })
  }, [])

  const invalid = preview?.rows.filter((row) => row.error !== null) ?? []
  const valid = (preview?.rows.length ?? 0) - invalid.length
  const canApply =
    preview !== null && preview.fileError === null && invalid.length === 0 && valid > 0

  return (
    <div className="flex flex-col gap-4">
      <FormBanner message={state.formError} />

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".csv,text/csv"
          aria-label="CSV 파일"
          data-testid="gacha-csv-input"
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
          <p className="text-muted text-[13px]" data-testid="gacha-import-summary">
            {preview.fileName} — 유효 {valid}건 · 오류 {invalid.length}건
          </p>

          {preview.fileError !== null && <FormBanner message={preview.fileError} />}

          {preview.rows.length > 0 && <GachaImportPreviewTable rows={preview.rows} />}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPreview(null)} disabled={isPending}>
              취소
            </Button>
            <Button disabled={!canApply || isPending} onClick={() => setConfirmOpen(true)}>
              {`적용 (${valid}건)`}
            </Button>
          </div>

          <Dialog
            open={isConfirmOpen}
            onClose={() => setConfirmOpen(false)}
            title="CSV 적용"
            description={`${valid}건을 적용합니다. 이름이 같은 기존 항목은 덮어쓰고, 없으면 새로 만듭니다. 덮어쓴 값은 되돌릴 수 없습니다.`}
          >
            <form action={formAction} className="flex flex-col gap-4">
              <input type="hidden" name="csv" value={preview.csv} readOnly />
              <input type="hidden" name="tab" value={tab} readOnly />

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

/** 헤더 + 예시 1행. 운영자가 열의 순서와 표기를 눈으로 확인하고 시작하게 한다. */
function downloadTemplate(): void {
  const blob = new Blob([toCsvFile([[...GACHA_CSV_HEADERS], SAMPLE_ROW])], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = 'gacha-template.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}
