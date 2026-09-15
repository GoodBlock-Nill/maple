import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { NewsRowActions } from '@/components/news/NewsRowActions'

import type { NewsStatus } from '@/lib/constants/news'

/**
 * 행에 그려지는 숨김 계열 버튼은 **지금 걸 수 있는 조치**만이어야 한다.
 *
 * 임시저장·예약 글은 독자에게 이미 보이지 않으므로 숨길 것이 없다. 눌러도 서버가
 * 같은 규칙으로 거절하므로, 버튼을 남겨 두면 "눌렀는데 빨간 토스트만 뜨는" 자리가
 * 된다. 수정·보기·삭제는 상태와 무관하게 그대로 둔다.
 *
 * 서버 액션은 `server-only` 를 끌어오므로 통째로 대신한다 — 여기서 확인하려는 것은
 * 버튼 구성이지 액션의 동작이 아니다(그쪽은 `news-actions.test.ts`).
 */

vi.mock('@/lib/actions/news-actions', () => ({
  newsStateAction: vi.fn(async () => ({ message: '1건을 숨겼습니다.' })),
}))

function renderRow(status: NewsStatus) {
  render(
    <NewsRowActions
      id="9f1c3f2e-0000-4000-8000-000000000001"
      title="9월 정기 점검 안내"
      status={status}
      previewUrl="https://example.com/news/9f1c3f2e-0000-4000-8000-000000000001"
    />,
  )
}

function buttonNames(): string[] {
  return screen.getAllByRole('button').map((button) => button.textContent ?? '')
}

describe('NewsRowActions — 숨김 계열 버튼', () => {
  it('should offer 숨김 when the post is published', () => {
    // Arrange & Act
    renderRow('published')

    // Assert
    expect(screen.getByRole('button', { name: '숨김' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '숨김 해제' })).toBeNull()
  })

  it('should offer 숨김 해제 when the post is hidden', () => {
    renderRow('hidden')

    expect(screen.getByRole('button', { name: '숨김 해제' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '숨김' })).toBeNull()
  })

  it('should offer neither when the post is a draft', () => {
    renderRow('draft')

    expect(buttonNames()).toEqual(['삭제'])
  })

  it('should offer neither when the post is scheduled', () => {
    renderRow('scheduled')

    expect(buttonNames()).toEqual(['삭제'])
  })

  it('should keep 수정 · 보기 · 삭제 on a draft row', () => {
    renderRow('draft')

    expect(screen.getByRole('link', { name: '수정' })).toHaveAttribute(
      'href',
      '/news/9f1c3f2e-0000-4000-8000-000000000001',
    )
    expect(
      screen.getByRole('link', { name: '9월 정기 점검 안내 클라이언트에서 보기' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument()
  })

  it('should leave only 복구 when the post is deleted', () => {
    renderRow('deleted')

    expect(buttonNames()).toEqual(['복구'])
  })
})
