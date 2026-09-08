'use client'

import { useActionState, useCallback, useMemo, useState } from 'react'

import { buildNewsColumns } from '@/components/news/news-columns'
import { Button } from '@/components/ui/Button'
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
 */

type NewsTableProps = {
  rows: readonly NewsListItem[]
  sort: SortState
  /** 정렬 키 → 헤더 링크 URL. */
  sortHrefs: Record<string, string>
  clientSiteUrl: string
}

export function NewsTable({ rows, sort, sortHrefs, clientSiteUrl }: NewsTableProps) {
  const [selected, setSelected] = useState<readonly string[]>([])
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
      }),
    [allSelected, clientSiteUrl, selected, toggle, toggleAll],
  )

  const hasSelection = selected.length > 0

  return (
    <form action={formAction}>
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
          type="submit"
          name="intent"
          value="delete"
          variant="danger"
          size="sm"
          disabled={!hasSelection || isPending}
        >
          선택 삭제
        </Button>
      </div>

      <Table
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        sort={sort}
        buildSortHref={(key) => sortHrefs[key] ?? '/news'}
        caption="뉴스 목록"
        emptyMessage="조건에 맞는 뉴스가 없습니다."
      />
    </form>
  )
}
