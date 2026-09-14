import { describe, expect, it } from 'vitest'

import {
  legalConfirmCopy,
  legalStripChips,
  parseLegalTab,
  resolveLegalDocumentState,
} from '@/lib/validation/legal-state'

import type { LegalStateVersion } from '@/lib/validation/legal-state'

/**
 * 목록 카드와 상세 화면이 같은 말을 해야 한다 — "지금 시행 중인 것 / 예약된 것 /
 * 이어서 고칠 초안". 셋이 겹치거나 빠지면 운영자는 어떤 버튼을 눌러야 할지
 * 화면만 보고 알 수 없다.
 */

const TODAY = '2026-09-15'

function version(overrides: Partial<LegalStateVersion> & { id: string }): LegalStateVersion {
  return {
    version: overrides.id,
    effectiveDate: TODAY,
    isPublished: true,
    publishedAt: '2026-09-15T00:00:00Z',
    createdAt: '2026-09-15T00:00:00Z',
    ...overrides,
  }
}

describe('resolveLegalDocumentState', () => {
  it('should split the versions into current, scheduled and drafts', () => {
    const state = resolveLegalDocumentState(
      [
        version({ id: 'live', effectiveDate: '2026-09-01' }),
        version({ id: 'next', effectiveDate: '2026-10-01' }),
        version({ id: 'draft', isPublished: false, publishedAt: null }),
      ],
      TODAY,
    )

    expect(state.current?.id).toBe('live')
    expect(state.scheduled?.id).toBe('next')
    expect(state.drafts.map((draft) => draft.id)).toEqual(['draft'])
  })

  it('should pick the nearest scheduled version', () => {
    const state = resolveLegalDocumentState(
      [
        version({ id: 'live', effectiveDate: '2026-09-01' }),
        version({ id: 'far', effectiveDate: '2026-12-01' }),
        version({ id: 'near', effectiveDate: '2026-10-01' }),
      ],
      TODAY,
    )

    expect(state.scheduled?.id).toBe('near')
  })

  it('should not repeat the current version in the scheduled row', () => {
    /* 발행본이 전부 미래 시행일이면 current_legal_version() 은 그중 최신 발행본을
       돌려준다 — 사용자 화면에 실제로 보이는 그 버전이다. 예약 줄에 또 적으면
       같은 버전이 두 줄에 나온다. */
    const state = resolveLegalDocumentState(
      [version({ id: 'only', effectiveDate: '2026-10-01' })],
      TODAY,
    )

    expect(state.current?.id).toBe('only')
    expect(state.scheduled).toBeNull()
  })

  it('should order drafts newest first', () => {
    const state = resolveLegalDocumentState(
      [
        version({
          id: 'old',
          isPublished: false,
          publishedAt: null,
          createdAt: '2026-09-10T00:00:00Z',
        }),
        version({
          id: 'new',
          isPublished: false,
          publishedAt: null,
          createdAt: '2026-09-14T00:00:00Z',
        }),
      ],
      TODAY,
    )

    expect(state.drafts.map((draft) => draft.id)).toEqual(['new', 'old'])
  })

  it('should report nothing for an empty document', () => {
    const state = resolveLegalDocumentState([], TODAY)

    expect(state).toEqual({ current: null, scheduled: null, drafts: [] })
  })
})

describe('parseLegalTab', () => {
  it('should read the three known panels', () => {
    expect(parseLegalTab('edit')).toBe('edit')
    expect(parseLegalTab('preview')).toBe('preview')
    expect(parseLegalTab('history')).toBe('history')
  })

  it('should fall back to the editor for anything else', () => {
    expect(parseLegalTab(undefined)).toBe('edit')
    expect(parseLegalTab('')).toBe('edit')
    expect(parseLegalTab('diff')).toBe('edit')
  })

  it('should use the first value when the key repeats', () => {
    expect(parseLegalTab(['history', 'preview'])).toBe('history')
  })
})

describe('legalStripChips', () => {
  it('should label the current and the scheduled version with its start date', () => {
    const chips = legalStripChips(
      resolveLegalDocumentState(
        [
          version({ id: 'live', version: '20260901', effectiveDate: '2026-09-01' }),
          version({ id: 'next', version: '20261001', effectiveDate: '2026-10-01' }),
        ],
        TODAY,
      ),
      TODAY,
    )

    expect(chips.map((chip) => chip.label)).toEqual([
      '시행 중 20260901',
      '예약 20261001 (10/1부터)',
    ])
    expect(chips.map((chip) => chip.versionId)).toEqual(['live', 'next'])
    expect(chips.map((chip) => chip.status)).toEqual(['published', 'scheduled'])
  })

  it('should list every draft while there are at most three', () => {
    const drafts = ['a', 'b', 'c'].map((id, index) =>
      version({
        id,
        version: `2026090${index + 1}`,
        isPublished: false,
        publishedAt: null,
        createdAt: `2026-09-0${index + 1}T00:00:00Z`,
      }),
    )

    const chips = legalStripChips(resolveLegalDocumentState(drafts, TODAY), TODAY)

    expect(chips.map((chip) => chip.label)).toEqual([
      '초안 20260903',
      '초안 20260902',
      '초안 20260901',
    ])
  })

  it('should fold four or more drafts into the newest one plus a count', () => {
    const drafts = [1, 2, 3, 4].map((index) =>
      version({
        id: `draft-${index}`,
        version: `2026090${index}`,
        isPublished: false,
        publishedAt: null,
        createdAt: `2026-09-0${index}T00:00:00Z`,
      }),
    )

    const chips = legalStripChips(resolveLegalDocumentState(drafts, TODAY), TODAY)

    expect(chips).toHaveLength(1)
    expect(chips[0]?.label).toBe('초안 20260904 외 3건')
    expect(chips[0]?.versionId).toBe('draft-4')
  })

  it('should not call a future dated version 시행 중', () => {
    /* 시행 전인데도 독자에게 보이는 경우가 있다(발행본이 전부 미래 시행일).
       그때 "시행 중"이라고 적으면 바로 옆 시행일과 어긋난다. */
    const chips = legalStripChips(
      resolveLegalDocumentState(
        [version({ id: 'only', version: '20261001', effectiveDate: '2026-10-01' })],
        TODAY,
      ),
      TODAY,
    )

    expect(chips[0]?.label).toBe('노출 중 20261001')
    expect(chips[0]?.status).toBe('scheduled')
  })

  it('should draw nothing for an empty document', () => {
    expect(legalStripChips(resolveLegalDocumentState([], TODAY), TODAY)).toEqual([])
  })
})

describe('legalConfirmCopy', () => {
  it('should warn that publishing is immediate and final', () => {
    const copy = legalConfirmCopy('publish', TODAY)

    expect(copy?.description).toBe(
      '저장 즉시 사용자 사이트에 공개됩니다. 발행한 개정본은 수정할 수 없습니다.',
    )
    expect(copy?.action).toBe('발행')
  })

  it('should name the effective date when scheduling', () => {
    const copy = legalConfirmCopy('schedule', '2026-10-01')

    expect(copy?.description).toBe(
      '2026년 10월 1일부터 사용자 사이트에 공개됩니다. 발행한 개정본은 수정할 수 없습니다.',
    )
    expect(copy?.action).toBe('예약')
  })

  it('should not interrupt a draft save', () => {
    expect(legalConfirmCopy('draft', TODAY)).toBeNull()
  })
})
