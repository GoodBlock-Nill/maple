import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Badge } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'
import { Table, type Column } from '@/components/ui/Table'

type Row = { id: string; nickname: string }

const COLUMNS: readonly Column<Row>[] = [
  { key: 'nickname', header: '닉네임', cell: (row) => row.nickname, sortKey: 'nickname' },
]

describe('Badge', () => {
  it('should render its children', () => {
    render(<Badge tone="danger">미처리</Badge>)

    expect(screen.getByText('미처리')).toBeInTheDocument()
  })
})

describe('StatCard', () => {
  it('should show the label, value and hint', () => {
    render(<StatCard label="신규 가입" value="12" hint="7일 40 · 30일 120" />)

    expect(screen.getByText('신규 가입')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('7일 40 · 30일 120')).toBeInTheDocument()
  })
})

describe('Table', () => {
  it('should render a row per item', () => {
    render(
      <Table columns={COLUMNS} rows={[{ id: '1', nickname: '길동' }]} getRowKey={(row) => row.id} />,
    )

    expect(screen.getByText('길동')).toBeInTheDocument()
  })

  it('should show the empty message when there are no rows', () => {
    render(<Table columns={COLUMNS} rows={[]} getRowKey={(row) => row.id} emptyMessage="없음" />)

    expect(screen.getByText('없음')).toBeInTheDocument()
  })

  it('should mark a sortable header as unsorted until a sort is applied', () => {
    render(
      <Table
        columns={COLUMNS}
        rows={[]}
        getRowKey={(row) => row.id}
        buildSortHref={(key) => `/x?sort=${key}:desc`}
      />,
    )

    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'none')
  })

  it('should expose the active sort direction to assistive technology', () => {
    render(
      <Table
        columns={COLUMNS}
        rows={[]}
        getRowKey={(row) => row.id}
        sort={{ key: 'nickname', direction: 'asc' }}
        buildSortHref={(key) => `/x?sort=${key}:desc`}
      />,
    )

    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'ascending')
  })

  it('should render skeleton rows while loading', () => {
    const { container } = render(
      <Table columns={COLUMNS} rows={[]} getRowKey={(row) => row.id} isLoading skeletonRows={3} />,
    )

    expect(container.querySelectorAll('tbody tr')).toHaveLength(3)
  })
})
