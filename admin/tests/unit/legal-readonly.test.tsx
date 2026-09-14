import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { LegalPublishConfirm } from '@/components/legal/LegalPublishConfirm'
import { LegalPublishFields } from '@/components/legal/LegalPublishFields'
import { LegalReadOnlyBanner } from '@/components/legal/LegalReadOnlyBanner'
import { legalConfirmCopy } from '@/lib/validation/legal-state'

/**
 * 발행본을 열었을 때 화면이 말해야 하는 것: **왜 안 고쳐지는지**와 **다음에 무엇을
 * 할지**. 잠금만 걸고 이유를 화면 끝에 적어 두면 운영자는 잠금을 고장으로 읽는다.
 */

describe('LegalReadOnlyBanner', () => {
  it('should explain the rule and offer the next step', () => {
    render(
      <LegalReadOnlyBanner
        newDraftHref="/legal/privacy?from=cur&tab=edit"
        historyHref="/legal/privacy?tab=history"
      />,
    )

    expect(screen.getByText('발행된 개정본은 수정할 수 없습니다.')).toBeInTheDocument()
    expect(
      screen.getByText('문안을 바꾸려면 이 버전을 복사한 새 초안에서 작업하세요.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '이 버전으로 새 초안 만들기' })).toHaveAttribute(
      'href',
      '/legal/privacy?from=cur&tab=edit',
    )
    expect(screen.getByRole('link', { name: '이력 보기' })).toHaveAttribute(
      'href',
      '/legal/privacy?tab=history',
    )
  })
})

describe('LegalPublishFields — 잠금', () => {
  it('should disable version, effective date and the mode radios', () => {
    const { container } = render(
      <LegalPublishFields
        defaultVersion="20260918"
        defaultEffectiveDate="2026-09-18"
        mode="publish"
        onModeChange={vi.fn()}
        isLocked
      />,
    )

    expect(screen.getByRole('textbox', { name: /버전/u })).toBeDisabled()
    /* 날짜 입력은 접근성 역할이 브라우저마다 갈려(jsdom 은 역할이 없다) 이름으로 집는다. */
    expect(container.querySelector('input[name="effectiveDate"]')).toBeDisabled()

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled()
    }
  })
})

describe('LegalPublishConfirm', () => {
  it('should ask once before an irreversible save', () => {
    render(
      <LegalPublishConfirm
        copy={legalConfirmCopy('publish', '2026-09-15')}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog')).toHaveTextContent('지금 발행할까요?')
    expect(screen.getByRole('dialog')).toHaveTextContent(
      '저장 즉시 사용자 사이트에 공개됩니다. 발행한 개정본은 수정할 수 없습니다.',
    )
    expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '발행' })).toBeInTheDocument()
  })

  it('should stay closed for a draft save', () => {
    render(
      <LegalPublishConfirm
        copy={legalConfirmCopy('draft', '2026-09-15')}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
