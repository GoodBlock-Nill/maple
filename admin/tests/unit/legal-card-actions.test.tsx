import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LegalDocumentCard } from '@/components/legal/LegalDocumentCard'

import type { LegalDocumentSummary, LegalVersion } from '@/lib/data/legal'

/**
 * 카드의 첫 번째 버튼이 곧 "지금 할 일"이다.
 *
 * 이어서 고칠 초안이 있으면 그것을 열고, 없으면 발행본을 복사해 새 초안을 연다.
 * 예전의 `편집` 한 개는 둘 중 무엇이 일어날지 알려 주지 않았고, 발행본은 애초에
 * 고칠 수 없어서 이름 자체가 사실과 달랐다.
 */

function version(overrides: Partial<LegalVersion> & { id: string }): LegalVersion {
  return {
    version: overrides.id,
    effectiveDate: '2026-09-01',
    contentHtml: '<p>문안</p>',
    summary: '',
    isPublished: true,
    publishedAt: '2026-09-01T00:00:00Z',
    createdAt: '2026-09-01T00:00:00Z',
    createdBy: null,
    ...overrides,
  }
}

const CURRENT = version({ id: 'cur', version: '20260901' })
const SCHEDULED = version({ id: 'next', version: '20261001', effectiveDate: '2026-10-01' })
const DRAFT = version({
  id: 'draft-1',
  version: '20260915',
  isPublished: false,
  publishedAt: null,
  createdAt: '2026-09-14T01:00:00Z',
})

function renderCard(state: LegalDocumentSummary['state'], canWrite = true) {
  render(
    <LegalDocumentCard
      document={{
        slug: 'privacy',
        label: '개인정보처리방침',
        title: '개인정보처리방침',
        state,
        versionCount: [state.current, state.scheduled].filter(Boolean).length + state.drafts.length,
      }}
      siteUrl="https://example.com"
      canWrite={canWrite}
    />,
  )
}

describe('LegalDocumentCard — 상태별 버튼', () => {
  it('should continue the newest draft when one exists', () => {
    renderCard({ current: CURRENT, scheduled: null, drafts: [DRAFT] })

    const primary = screen.getByTestId('legal-card-primary')

    expect(primary).toHaveTextContent('초안 이어서 편집')
    expect(primary).toHaveAttribute('href', '/legal/privacy?version=draft-1')
  })

  it('should copy the published version when there is no draft', () => {
    renderCard({ current: CURRENT, scheduled: null, drafts: [] })

    const primary = screen.getByTestId('legal-card-primary')

    expect(primary).toHaveTextContent('새 초안 만들기')
    expect(primary).toHaveAttribute('href', '/legal/privacy?from=cur')
  })

  it('should open an empty draft when nothing has been written yet', () => {
    renderCard({ current: null, scheduled: null, drafts: [] })

    expect(screen.getByTestId('legal-card-primary')).toHaveAttribute(
      'href',
      '/legal/privacy?from=new',
    )
    expect(screen.queryByRole('link', { name: '현재 발행본 보기' })).toBeNull()
    expect(screen.getByText('미발행')).toBeInTheDocument()
  })

  it('should link the published version and the history tab', () => {
    renderCard({ current: CURRENT, scheduled: null, drafts: [] })

    expect(screen.getByRole('link', { name: '현재 발행본 보기' })).toHaveAttribute(
      'href',
      '/legal/privacy?version=cur',
    )
    expect(screen.getByRole('link', { name: '버전 이력' })).toHaveAttribute(
      'href',
      '/legal/privacy?tab=history',
    )
  })

  it('should never offer the ambiguous 편집 label', () => {
    renderCard({ current: CURRENT, scheduled: SCHEDULED, drafts: [DRAFT] })

    expect(screen.queryByRole('link', { name: '편집' })).toBeNull()
  })

  it('should leave read-only admins with the client link only', () => {
    renderCard({ current: CURRENT, scheduled: null, drafts: [DRAFT] }, false)

    expect(screen.queryByTestId('legal-card-primary')).toBeNull()
    expect(screen.getByRole('link', { name: '클라이언트 ↗' })).toBeInTheDocument()
  })
})

describe('LegalDocumentCard — 상태 줄', () => {
  it('should show the effective, the scheduled and the draft rows', () => {
    renderCard({ current: CURRENT, scheduled: SCHEDULED, drafts: [DRAFT] })

    /* 같은 낱말이 상태 뱃지에도 있어 `selector` 로 정의 목록만 고른다. */
    expect(screen.getByText('시행 중', { selector: 'dt' }).parentElement).toHaveTextContent(
      '20260901 · 2026-09-01',
    )
    expect(screen.getByText('예약', { selector: 'dt' }).parentElement).toHaveTextContent(
      '20261001 · 2026-10-01',
    )
    expect(screen.getByText('초안', { selector: 'dt' }).parentElement).toHaveTextContent(
      '1건 · 최근 2026-09-14',
    )
  })

  it('should say 노출 중 when the visible version has not taken effect yet', () => {
    /* 발행본이 전부 미래 시행일이면 RPC 는 그중 최신본을 돌려준다 — 시행 전인데도
       독자는 그것을 본다. "시행 중"이라고 적으면 옆의 시행일과 어긋난다. */
    renderCard({ current: SCHEDULED, scheduled: null, drafts: [] })

    expect(screen.queryByText('시행 중', { selector: 'dt' })).toBeNull()
    expect(screen.getByText('노출 중', { selector: 'dt' }).parentElement).toHaveTextContent(
      '20261001 · 2026-10-01',
    )
  })

  it('should drop the scheduled row and say so when there is no draft', () => {
    renderCard({ current: CURRENT, scheduled: null, drafts: [] })

    expect(screen.queryByText('예약', { selector: 'dt' })).toBeNull()
    expect(screen.getByText('초안', { selector: 'dt' }).parentElement).toHaveTextContent('없음')
  })
})
