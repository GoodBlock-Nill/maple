import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { InquiryStatusBadge } from '@/components/inquiries/InquiryStatusBadge'
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

  /* 사용자 사이트와 색을 맞춘 두 톤. 토큰 이름이 바뀌면 사용자 화면과 관리자 화면의
     문의 상태 색이 조용히 갈리므로 클래스까지 고정한다. */
  it('should paint the info-blue tone with the client blue tokens', () => {
    render(<Badge tone="info-blue">처리 중</Badge>)

    expect(screen.getByText('처리 중')).toHaveClass('bg-info-blue-soft', 'text-info-blue')
  })

  it('should paint the success-green tone with the client green tokens', () => {
    render(<Badge tone="success-green">답변 완료</Badge>)

    expect(screen.getByText('답변 완료')).toHaveClass('bg-success-green-soft', 'text-success-green')
  })
})

describe('InquiryStatusBadge', () => {
  /* 관리자와 사용자가 같은 문의를 본다. 라벨과 색이 어긋나면 운영자가 화면을 보며
     사용자에게 상태를 설명할 수 없다(사용자 쪽: lib/constants/support.ts). */
  it.each([
    ['pending', '접수 대기', 'bg-page'],
    ['in_progress', '처리 중', 'bg-info-blue-soft'],
    ['answered', '답변 완료', 'bg-success-green-soft'],
    ['closed', '종료', 'bg-surface'],
  ] as const)('should show %s as the client does', (status, label, background) => {
    render(<InquiryStatusBadge status={status} />)

    expect(screen.getByText(label)).toHaveClass(background)
  })

  it('should mark a user-cancelled inquiry apart from an operator-closed one', () => {
    render(<InquiryStatusBadge status="closed" cancelledAt="2026-09-09T00:00:00.000Z" />)

    expect(screen.getByText('접수 취소')).toHaveClass('bg-surface', 'text-muted')
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
      <Table
        columns={COLUMNS}
        rows={[{ id: '1', nickname: '길동' }]}
        getRowKey={(row) => row.id}
      />,
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
