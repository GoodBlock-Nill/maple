import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { InquiryFields } from '@/components/support/InquiryFields'

import type { InquiryCategoryOption } from '@/types/domain'

const CONNECTION_PREFILL = '글자월드 캐릭터 닉네임:\n\n발생 일시:\n상세 내용:'
const ETC_PREFILL = '글자월드 캐릭터 닉네임:\n\n건의 주제:'

const CATEGORIES: readonly InquiryCategoryOption[] = [
  {
    key: 'connection',
    label: '접속·서버',
    description: '로그인·접속 불가, 강제 종료.',
    prefill: CONNECTION_PREFILL,
  },
  { key: 'etc', label: '기타·건의', description: null, prefill: ETC_PREFILL },
]

function renderFields(values?: Parameters<typeof InquiryFields>[0]['values']) {
  return render(<InquiryFields categories={CATEGORIES} values={values} fieldErrors={{}} />)
}

function content(): HTMLTextAreaElement {
  return screen.getByLabelText('문의 내용')
}

describe('InquiryFields', () => {
  it('should list the categories the server sent', () => {
    // Arrange & Act
    renderFields()

    // Assert
    const select = screen.getByLabelText('카테고리 및 유형 선택')
    expect(
      Array.from(select.querySelectorAll('option')).map((option) => option.textContent),
    ).toEqual(['카테고리를 선택해주세요', '접속·서버', '기타·건의'])
  })

  it('should prefill the content when a category is selected', async () => {
    // Arrange
    const user = userEvent.setup()
    renderFields()

    // Act
    await user.selectOptions(screen.getByLabelText('카테고리 및 유형 선택'), '접속·서버')

    // Assert
    expect(content()).toHaveValue(CONNECTION_PREFILL)
  })

  it('should show the category description under the select', async () => {
    // Arrange
    const user = userEvent.setup()
    renderFields()

    // Act
    await user.selectOptions(screen.getByLabelText('카테고리 및 유형 선택'), '접속·서버')

    // Assert — 설명이 없는 카테고리로 옮기면 안내도 함께 사라진다.
    expect(screen.getByText('로그인·접속 불가, 강제 종료.')).toBeInTheDocument()
  })

  it('should swap templates without asking when the previous one is untouched', async () => {
    // Arrange
    const user = userEvent.setup()
    renderFields()
    const select = screen.getByLabelText('카테고리 및 유형 선택')
    await user.selectOptions(select, '접속·서버')

    // Act
    await user.selectOptions(select, '기타·건의')

    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(content()).toHaveValue(ETC_PREFILL)
  })

  it('should ask before discarding what the user typed', async () => {
    // Arrange
    const user = userEvent.setup()
    renderFields()
    const select = screen.getByLabelText('카테고리 및 유형 선택')
    await user.selectOptions(select, '접속·서버')
    await user.type(content(), '어제부터 접속이 안 됩니다.')

    // Act
    await user.selectOptions(select, '기타·건의')

    // Assert — 확인 전에는 카테고리도 내용도 그대로다.
    expect(screen.getByRole('dialog')).toHaveAccessibleName('작성 중인 내용이 지워집니다')
    expect(select).toHaveValue('접속·서버')
    expect(content().value).toContain('어제부터 접속이 안 됩니다.')
  })

  it('should replace the content after the confirmation', async () => {
    // Arrange
    const user = userEvent.setup()
    renderFields()
    const select = screen.getByLabelText('카테고리 및 유형 선택')
    await user.selectOptions(select, '접속·서버')
    await user.type(content(), '어제부터 접속이 안 됩니다.')
    await user.selectOptions(select, '기타·건의')

    // Act
    await user.click(screen.getByRole('button', { name: '카테고리 변경' }))

    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(select).toHaveValue('기타·건의')
    expect(content()).toHaveValue(ETC_PREFILL)
  })

  it('should keep the previous category when the confirmation is cancelled', async () => {
    // Arrange
    const user = userEvent.setup()
    renderFields()
    const select = screen.getByLabelText('카테고리 및 유형 선택')
    await user.selectOptions(select, '접속·서버')
    await user.type(content(), '어제부터 접속이 안 됩니다.')
    await user.selectOptions(select, '기타·건의')

    // Act
    await user.click(screen.getByRole('button', { name: '취소' }))

    // Assert
    expect(select).toHaveValue('접속·서버')
    expect(content().value).toContain('어제부터 접속이 안 됩니다.')
  })

  it('should keep a saved inquiry untouched until the user changes the category', async () => {
    // Arrange — 수정 화면. 사용자가 쓴 내용이므로 바꾸려면 확인을 거친다.
    const user = userEvent.setup()
    renderFields({
      accountId: '123456789000000',
      category: '접속·서버',
      type: '문의',
      title: '로그인 오류',
      content: '어제부터 로그인이 되지 않습니다.',
    })

    // Act
    await user.selectOptions(screen.getByLabelText('카테고리 및 유형 선택'), '기타·건의')

    // Assert
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(content()).toHaveValue('어제부터 로그인이 되지 않습니다.')
  })
})
