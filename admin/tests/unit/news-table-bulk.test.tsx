import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { NewsTable } from '@/components/news/NewsTable'

import type { NewsListItem } from '@/lib/data/news'
import type { NewsStatus } from '@/lib/constants/news'

/**
 * 일괄 처리 바의 두 버튼은 **지금 걸 수 있는 조치**만 열어야 한다.
 *
 * 숨김은 발행된 글에만, 해제는 숨긴 글에만 걸린다. 고른 것 중 대상이 한 건도 없는데
 * 버튼이 열려 있으면, 누른 **뒤에** 빨간 토스트로 거절을 알게 된다 — 서버가 같은
 * 규칙으로 막으므로 화면이 먼저 닫는 편이 낫다. 옆의 "발행 N건 · 숨김 M건" 은 20건을
 * 골라도 3건만 처리된다는 것을 누르기 전에 알리는 표시다.
 *
 * 선택은 체크박스로 실제로 만든다 — 확인하려는 것이 `countEligible` 의 셈뿐이라면
 * 단위 테스트로 충분하지만(`news-state-eligibility.test.ts`), 여기서는 그 값이
 * 버튼의 `disabled` 와 안내 문구까지 흘러가는지를 본다.
 *
 * 서버 액션은 `server-only` 를 끌어오므로 통째로 대신한다.
 */

vi.mock('@/lib/actions/news-actions', () => ({
  newsStateAction: vi.fn(async () => ({ message: '1건을 숨겼습니다.' })),
}))

function makeRow(id: string, title: string, status: NewsStatus): NewsListItem {
  return {
    id,
    title,
    summary: '',
    categoryKey: 'notice',
    status,
    visibility: status === 'published' ? 'visible' : 'invisible',
    publishedAt: '2026-09-15T00:00:00.000Z',
    viewCount: 0,
    updatedAt: '2026-09-15T00:00:00.000Z',
    isPinned: false,
    authorName: '운영자',
  }
}

const ROWS: readonly NewsListItem[] = [
  makeRow('11111111-0000-4000-8000-000000000001', '발행된 글', 'published'),
  makeRow('11111111-0000-4000-8000-000000000002', '숨긴 글', 'hidden'),
  makeRow('11111111-0000-4000-8000-000000000003', '임시저장 글', 'draft'),
]

function renderTable(canWrite = true) {
  render(
    <NewsTable
      rows={ROWS}
      sort={{ key: 'published_at', direction: 'desc' }}
      sortHrefs={{ published_at: '/news?sort=published_at%3Aasc' }}
      clientSiteUrl="https://example.com"
      canWrite={canWrite}
    />,
  )
}

function hideButton(): HTMLElement {
  return screen.getByRole('button', { name: '선택 숨김' })
}

function unhideButton(): HTMLElement {
  return screen.getByRole('button', { name: '선택 숨김 해제' })
}

/** 행 체크박스를 켠다. 라벨은 `{제목} 선택`(`buildNewsColumns`). */
async function select(title: string): Promise<void> {
  await userEvent.click(screen.getByRole('checkbox', { name: `${title} 선택` }))
}

describe('NewsTable — 일괄 처리 바', () => {
  it('should offer both 선택 숨김 and 선택 숨김 해제 when the operator can write', () => {
    // Arrange & Act
    renderTable()

    // Assert
    expect(hideButton()).toBeInTheDocument()
    expect(unhideButton()).toBeInTheDocument()
  })

  it('should disable both buttons when nothing is selected', () => {
    renderTable()

    expect(hideButton()).toBeDisabled()
    expect(unhideButton()).toBeDisabled()
  })

  it('should enable 선택 숨김 해제 when the selection has a hidden row', async () => {
    // Arrange
    renderTable()

    // Act
    await select('숨긴 글')

    // Assert
    expect(unhideButton()).toBeEnabled()
  })

  it('should keep 선택 숨김 disabled when the selection has only a hidden row', async () => {
    renderTable()

    await select('숨긴 글')

    expect(hideButton()).toBeDisabled()
  })

  it('should disable 선택 숨김 해제 when the selection has no hidden row', async () => {
    renderTable()

    await select('발행된 글')

    expect(unhideButton()).toBeDisabled()
    expect(hideButton()).toBeEnabled()
  })

  it('should disable both buttons when the selection is a draft only', async () => {
    // 임시저장 글은 독자에게 이미 보이지 않아 숨길 것도 되돌릴 것도 없다.
    renderTable()

    await select('임시저장 글')

    expect(hideButton()).toBeDisabled()
    expect(unhideButton()).toBeDisabled()
  })

  it('should enable both buttons when the selection mixes a published and a hidden row', async () => {
    renderTable()

    await select('발행된 글')
    await select('숨긴 글')

    expect(hideButton()).toBeEnabled()
    expect(unhideButton()).toBeEnabled()
  })

  it('should hide the count hint until something is selected', () => {
    renderTable()

    expect(screen.getByText('0건 선택')).toBeInTheDocument()
    expect(screen.queryByText(/발행 \d+건 · 숨김 \d+건/)).toBeNull()
  })

  it('should name both counts in the hint when a selection exists', async () => {
    renderTable()

    await select('발행된 글')
    await select('숨긴 글')
    await select('임시저장 글')

    // 3건을 골랐지만 숨김은 1건, 해제도 1건에만 걸린다.
    expect(screen.getByText('3건 선택')).toBeInTheDocument()
    expect(screen.getByText('발행 1건 · 숨김 1건')).toBeInTheDocument()
  })

  it('should not render the bulk bar at all without write permission', () => {
    renderTable(false)

    expect(screen.queryByRole('button', { name: '선택 숨김' })).toBeNull()
    expect(screen.queryByRole('button', { name: '선택 숨김 해제' })).toBeNull()
    expect(screen.queryByRole('button', { name: '선택 삭제' })).toBeNull()
  })
})
