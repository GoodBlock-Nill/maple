import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { InquiryReplyTemplatePicker } from '@/components/inquiries/InquiryReplyTemplatePicker'

/**
 * 템플릿 불러오기의 행동 규칙.
 *
 *   1. 빈 답변 칸이면 묻지 않고 바로 넣는다 — 잃을 것이 없다.
 *   2. 쓰던 글이 있으면 확인을 세운다. 확인 창은 '끝에 추가' 를 함께 내놓는다
 *      (여러 문안을 겹쳐 쓰는 답변이 흔하다).
 *   3. 넣는 문장에는 자리표시자가 남지 않는다 — 남으면 사용자 화면에 그대로 노출된다.
 */

const INQUIRY = {
  id: 'abcd1234-5678-4000-8000-000000000000',
  title: '아이템이 사라졌어요',
  category: '재화·아이템',
  nickname: '글자용사',
}

const TEMPLATES = [
  {
    id: 'template-common',
    name: '접수 확인 안내',
    body: '안녕하세요, {{닉네임}}님. 문의({{문의번호}})를 확인했습니다.',
    isCommon: true,
  },
  { id: 'template-category', name: '아이템 지급 완료', body: '지급했습니다.', isCommon: false },
]

const APPLIED = '안녕하세요, 글자용사님. 문의(ABCD1234)를 확인했습니다.'

function renderPicker(hasContent: boolean) {
  const onApply = vi.fn()

  render(
    <InquiryReplyTemplatePicker
      templates={TEMPLATES}
      inquiry={INQUIRY}
      hasContent={hasContent}
      onApply={onApply}
    />,
  )

  return { onApply, user: userEvent.setup() }
}

describe('InquiryReplyTemplatePicker', () => {
  it('should point to the management screen when nothing is available', () => {
    // Arrange & Act
    render(
      <InquiryReplyTemplatePicker
        templates={[]}
        inquiry={INQUIRY}
        hasContent={false}
        onApply={vi.fn()}
      />,
    )

    // Assert — 빈 셀렉트를 그리면 운영자가 "고장났나"를 먼저 의심한다.
    expect(screen.getByRole('link', { name: '답변 템플릿 관리' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('should mark common templates in the list', () => {
    // Arrange & Act
    renderPicker(false)

    // Assert — 어느 문의에서나 보이는 문안임을 목록에서 알 수 있어야 한다.
    expect(screen.getByRole('option', { name: '[공통] 접수 확인 안내' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '아이템 지급 완료' })).toBeInTheDocument()
  })

  it('should keep the button disabled until a template is chosen', async () => {
    // Arrange
    const { user } = renderPicker(false)
    const button = screen.getByRole('button', { name: '불러오기' })

    // Assert
    expect(button).toBeDisabled()

    // Act
    await user.selectOptions(screen.getByRole('combobox'), 'template-common')

    // Assert
    expect(button).toBeEnabled()
  })

  it('should insert the substituted body without asking when the field is empty', async () => {
    // Arrange
    const { onApply, user } = renderPicker(false)

    // Act
    await user.selectOptions(screen.getByRole('combobox'), 'template-common')
    await user.click(screen.getByRole('button', { name: '불러오기' }))

    // Assert
    expect(onApply).toHaveBeenCalledWith(APPLIED, 'replace')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('should confirm before throwing away a draft', async () => {
    // Arrange
    const { onApply, user } = renderPicker(true)

    // Act
    await user.selectOptions(screen.getByRole('combobox'), 'template-common')
    await user.click(screen.getByRole('button', { name: '불러오기' }))

    // Assert — 확인 창의 3요소: 제목 · 실제로 일어나는 일 · 취소 + 실행
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('템플릿 적용')
    expect(dialog).toHaveTextContent('작성 중인 답변이 지워집니다')
    expect(onApply).not.toHaveBeenCalled()

    // Act
    await user.click(screen.getByRole('button', { name: '템플릿으로 바꾸기' }))

    // Assert
    expect(onApply).toHaveBeenCalledWith(APPLIED, 'replace')
  })

  it('should offer appending instead of replacing', async () => {
    // Arrange
    const { onApply, user } = renderPicker(true)

    // Act
    await user.selectOptions(screen.getByRole('combobox'), 'template-common')
    await user.click(screen.getByRole('button', { name: '불러오기' }))
    await user.click(screen.getByRole('button', { name: '끝에 추가' }))

    // Assert
    expect(onApply).toHaveBeenCalledWith(APPLIED, 'append')
  })

  it('should change nothing when the confirmation is cancelled', async () => {
    // Arrange
    const { onApply, user } = renderPicker(true)

    // Act
    await user.selectOptions(screen.getByRole('combobox'), 'template-common')
    await user.click(screen.getByRole('button', { name: '불러오기' }))
    await user.click(screen.getByRole('button', { name: '취소' }))

    // Assert
    expect(onApply).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
