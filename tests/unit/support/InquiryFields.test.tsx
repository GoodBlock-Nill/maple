import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { InquiryFields } from '@/components/support/InquiryFields'

import type { InquiryCategoryOption } from '@/types/domain'

const CONNECTION_PREFILL = '글자월드 캐릭터 닉네임:\n\n발생 일시:\n상세 내용:'
const ETC_PREFILL = '글자월드 캐릭터 닉네임:\n\n건의 주제:'

const CONNECTION_SUBTYPES = ['로그인/접속 불가', '강제 종료', '지연/서버 장애']

const CATEGORIES: readonly InquiryCategoryOption[] = [
  {
    key: 'connection',
    label: '접속·서버',
    description: '로그인·접속 불가, 강제 종료.',
    prefill: CONNECTION_PREFILL,
    subtypes: CONNECTION_SUBTYPES,
  },
  /* 세부 유형이 없는 카테고리. 폼은 유형 셀렉트를 잠그고 '기타' 로 접수한다. */
  { key: 'etc', label: '기타·건의', description: null, prefill: ETC_PREFILL, subtypes: [] },
]

function renderFields(values?: Parameters<typeof InquiryFields>[0]['values']) {
  return render(<InquiryFields categories={CATEGORIES} values={values} fieldErrors={{}} />)
}

function content(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: '문의 내용' })
}

/* 라벨에는 필수 표시(*)가 붙어 있다. 접근성 이름으로 찾으면 장식(aria-hidden)이
   빠진 이름을 보게 되어, 표시가 바뀌어도 질의가 흔들리지 않는다. */
function categorySelect(): HTMLSelectElement {
  return screen.getByRole('combobox', { name: '카테고리 및 유형 선택' })
}

function typeSelect(): HTMLSelectElement {
  return screen.getByRole('combobox', { name: '세부 문의 유형 선택' })
}

function optionsOf(select: HTMLSelectElement): string[] {
  return Array.from(select.querySelectorAll('option')).map((option) => option.textContent ?? '')
}

describe('InquiryFields', () => {
  it('should list the categories the server sent', () => {
    // Arrange & Act
    renderFields()

    // Assert
    expect(optionsOf(categorySelect())).toEqual([
      '카테고리를 선택해주세요',
      '접속·서버',
      '기타·건의',
    ])
  })

  it('should prefill the content when a category is selected', async () => {
    // Arrange
    const user = userEvent.setup()
    renderFields()

    // Act
    await user.selectOptions(categorySelect(), '접속·서버')

    // Assert
    expect(content()).toHaveValue(CONNECTION_PREFILL)
  })

  it('should show the category description under the select', async () => {
    // Arrange
    const user = userEvent.setup()
    renderFields()

    // Act
    await user.selectOptions(categorySelect(), '접속·서버')

    // Assert — 설명이 없는 카테고리로 옮기면 안내도 함께 사라진다.
    expect(screen.getByText('로그인·접속 불가, 강제 종료.')).toBeInTheDocument()
  })

  it('should swap templates without asking when the previous one is untouched', async () => {
    // Arrange
    const user = userEvent.setup()
    renderFields()
    const select = categorySelect()
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
    const select = categorySelect()
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
    const select = categorySelect()
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
    const select = categorySelect()
    await user.selectOptions(select, '접속·서버')
    await user.type(content(), '어제부터 접속이 안 됩니다.')
    await user.selectOptions(select, '기타·건의')

    // Act
    await user.click(screen.getByRole('button', { name: '취소' }))

    // Assert
    expect(select).toHaveValue('접속·서버')
    expect(content().value).toContain('어제부터 접속이 안 됩니다.')
  })

  it('should keep the type select locked until a category is chosen', () => {
    // Arrange & Act — 카테고리 없이는 고를 것이 없다.
    renderFields()

    // Assert
    expect(typeSelect()).toBeDisabled()
    expect(optionsOf(typeSelect())).toEqual(['카테고리를 먼저 선택해주세요'])
  })

  it('should fill the type select with the subtypes of the chosen category', async () => {
    // Arrange
    const user = userEvent.setup()
    renderFields()

    // Act
    await user.selectOptions(categorySelect(), '접속·서버')

    // Assert
    expect(typeSelect()).toBeEnabled()
    expect(optionsOf(typeSelect())).toEqual([
      '세부 문의 유형을 선택해주세요',
      ...CONNECTION_SUBTYPES,
    ])
  })

  it('should clear the chosen type when the category changes', async () => {
    // Arrange — 유형은 카테고리에 매달려 있다. 남겨 두면 어긋난 조합이 제출된다.
    const user = userEvent.setup()
    renderFields()
    await user.selectOptions(categorySelect(), '접속·서버')
    await user.selectOptions(typeSelect(), '강제 종료')
    expect(typeSelect()).toHaveValue('강제 종료')

    // Act — 양식을 건드리지 않았으므로 확인 없이 바뀐다.
    await user.selectOptions(categorySelect(), '기타·건의')

    // Assert
    expect(typeSelect()).toHaveValue('')
  })

  it('should lock the type select and submit 기타 for a category without subtypes', async () => {
    // Arrange
    const user = userEvent.setup()
    const { container } = renderFields()

    // Act
    await user.selectOptions(categorySelect(), '기타·건의')

    // Assert — 셀렉트는 저장될 값을 보여 주기만 하고, 값은 hidden 이 싣는다.
    expect(typeSelect()).toBeDisabled()
    expect(optionsOf(typeSelect())).toEqual(['기타'])
    expect(container.querySelector('input[type="hidden"][name="type"]')).toHaveValue('기타')
  })

  it('should keep the type a saved inquiry was filed with', async () => {
    // Arrange — 접수 당시의 '문의'(옛 3종). 지금은 어느 카테고리에도 없는 값이다.
    const user = userEvent.setup()
    renderFields({
      accountId: '20123456789000000',
      category: '접속·서버',
      type: '문의',
      title: '로그인 오류',
      content: '어제부터 로그인이 되지 않습니다.',
    })

    // Assert — 목록 뒤에 붙어 셀렉트가 저장된 값을 그대로 보여 준다.
    expect(typeSelect()).toHaveValue('문의')
    expect(optionsOf(typeSelect())).toEqual([
      '세부 문의 유형을 선택해주세요',
      ...CONNECTION_SUBTYPES,
      '문의',
    ])

    // Act — 다른 세부 유형으로 바꾸면 옛 값은 목록에서 사라진다.
    await user.selectOptions(typeSelect(), '강제 종료')

    // Assert
    expect(optionsOf(typeSelect())).toEqual([
      '세부 문의 유형을 선택해주세요',
      ...CONNECTION_SUBTYPES,
    ])
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
    await user.selectOptions(categorySelect(), '기타·건의')

    // Assert
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(content()).toHaveValue('어제부터 로그인이 되지 않습니다.')
  })
})
