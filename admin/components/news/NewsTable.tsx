'use client'

import { useActionState, useCallback, useMemo, useState, useTransition } from 'react'

import { buildNewsColumns } from '@/components/news/news-columns'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Table } from '@/components/ui/Table'
import { useToast } from '@/components/ui/Toast'
import { EMPTY_FORM_STATE, type FormState } from '@/lib/actions/form-state'
import { newsStateAction } from '@/lib/actions/news-actions'

import type { NewsListItem } from '@/lib/data/news'
import type { SortState } from '@/lib/utils/table-query'

/**
 * 뉴스 목록 표 + 일괄 처리.
 *
 * 표 전체를 하나의 `<form>` 으로 감싼다. 체크박스가 `ids` 반복 필드로 모이고,
 * 일괄 버튼은 `name="intent"` 로 무엇을 할지 함께 보낸다 — 제출 버튼의 name/value
 * 도 FormData 에 담기므로 숨은 필드를 따로 둘 필요가 없다.
 *
 * 정렬 링크는 서버에서 미리 만들어 받는다(`sortHrefs`). 함수는 서버→클라이언트
 * 경계를 넘지 못하므로 `buildSortHref` 를 그대로 내려줄 수 없다.
 *
 * 일괄 삭제만 폼 제출이 아니라 확인 다이얼로그를 거쳐 트랜지션으로 부른다 —
 * 선택 목록이 이미 컴포넌트 상태에 있어 FormData 를 직접 만들 수 있고, 그래야
 * 다이얼로그의 버튼이 표 밖에 있어도 선택이 그대로 실린다.
 */

type NewsTableProps = {
  rows: readonly NewsListItem[]
  sort: SortState
  /** 정렬 키 → 헤더 링크 URL. */
  sortHrefs: Record<string, string>
  clientSiteUrl: string
  /** 쓰기 권한이 없으면 일괄 선택·행 조치를 아예 그리지 않는다. */
  canWrite: boolean
}

export function NewsTable({ rows, sort, sortHrefs, clientSiteUrl, canWrite }: NewsTableProps) {
  const [selected, setSelected] = useState<readonly string[]>([])
  const [isConfirmOpen, setConfirmOpen] = useState(false)
  const [isDeleting, startDelete] = useTransition()
  const { showToast } = useToast()

  const runBulk = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await newsStateAction(prevState, formData)

      if (result.formError !== undefined) {
        showToast(result.formError, 'error')
      } else {
        showToast(result.message ?? '처리했습니다.', 'success')
        setSelected([])
      }

      return result
    },
    [showToast],
  )

  const [, formAction, isPending] = useActionState(runBulk, EMPTY_FORM_STATE)

  const confirmDelete = useCallback(() => {
    const formData = new FormData()

    formData.set('intent', 'delete')

    for (const id of selected) {
      formData.append('ids', id)
    }

    startDelete(async () => {
      const result = await newsStateAction(EMPTY_FORM_STATE, formData)

      if (result.formError !== undefined) {
        showToast(result.formError, 'error')

        return
      }

      showToast(result.message ?? '삭제했습니다.', 'success')
      setSelected([])
      setConfirmOpen(false)
    })
  }, [selected, showToast])

  const toggle = useCallback((id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }, [])

  const allSelected = rows.length > 0 && selected.length === rows.length

  const toggleAll = useCallback(() => {
    setSelected(allSelected ? [] : rows.map((row) => row.id))
  }, [allSelected, rows])

  const columns = useMemo(
    () =>
      buildNewsColumns({
        selected,
        allSelected,
        onToggle: toggle,
        onToggleAll: toggleAll,
        clientSiteUrl,
        canWrite,
      }),
    [allSelected, canWrite, clientSiteUrl, selected, toggle, toggleAll],
  )

  const hasSelection = selected.length > 0

  return (
    <form action={formAction}>
      {canWrite && (
        <div
          aria-live="polite"
          className="border-line bg-page/60 flex min-h-11 flex-wrap items-center gap-2 border-b px-4 py-2"
        >
          <span className="text-muted text-[13px]">{selected.length}건 선택</span>
          <Button
            type="submit"
            name="intent"
            value="hide"
            variant="secondary"
            size="sm"
            disabled={!hasSelection || isPending}
          >
            선택 숨김
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={!hasSelection || isPending || isDeleting}
            onClick={() => setConfirmOpen(true)}
          >
            선택 삭제
          </Button>
        </div>
      )}

      <Table
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        sort={sort}
        buildSortHref={(key) => sortHrefs[key] ?? '/news'}
        caption="뉴스 목록"
        emptyMessage="조건에 맞는 뉴스가 없습니다."
      />

      <Dialog
        open={isConfirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="뉴스 삭제"
        description={`선택한 ${selected.length}건을 삭제합니다. 목록의 상태 필터에서 삭제를 골라 복구할 수 있습니다.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={isDeleting}>
              취소
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? '삭제 중…' : '삭제'}
            </Button>
          </>
        }
      >
        <p className="text-muted text-[13px]">
          삭제해도 데이터는 남습니다(소프트 삭제). 사용자 사이트에서는 즉시 사라집니다.
        </p>
      </Dialog>
    </form>
  )
}
