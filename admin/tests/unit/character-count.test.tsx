import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { countCharacters } from '@/components/ui/CharacterCount'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

/**
 * 글자수 표시.
 *
 * 관리자 화면의 모든 텍스트 필드가 `현재 / 최대` 를 보여 준다(2026-09-09 운영
 * 요청). 이 숫자가 브라우저 `maxLength` 가 끊는 지점과 어긋나면 운영자는 "아직
 * 남았는데 더 안 써진다"를 겪으므로, 세는 규칙과 갱신 시점을 고정한다.
 */

describe('countCharacters', () => {
  it('should count a plain string by character', () => {
    expect(countCharacters('가나다')).toBe(3)
  })

  /* `'👍'.length` 는 2다(서러게이트 페어). 화면 숫자가 2로 뛰면 상한이 반쪽이 된다. */
  it('should count a surrogate pair as one character', () => {
    expect(countCharacters('👍')).toBe(1)
  })

  it('should count an empty string as zero', () => {
    expect(countCharacters('')).toBe(0)
  })
})

describe('Input 글자수', () => {
  it('should show the counter when maxLength is set', () => {
    render(<Input label="제목" name="title" maxLength={10} />)

    expect(screen.getByText('0 / 10')).toBeInTheDocument()
  })

  it('should start from the uncontrolled default value', () => {
    render(<Input label="제목" name="title" maxLength={10} defaultValue="가나다" />)

    expect(screen.getByText('3 / 10')).toBeInTheDocument()
  })

  it('should update the counter while typing', async () => {
    const user = userEvent.setup()

    render(<Input label="제목" name="title" maxLength={10} />)
    await user.type(screen.getByLabelText('제목'), '가나')

    expect(screen.getByText('2 / 10')).toBeInTheDocument()
  })

  /* 상한에 닿은 순간을 색으로 알려 주지 않으면 입력이 먹통이 된 것처럼 보인다. */
  it('should turn to the danger colour at the limit', async () => {
    const user = userEvent.setup()

    render(<Input label="제목" name="title" maxLength={2} />)
    await user.type(screen.getByLabelText('제목'), '가나')

    expect(screen.getByText('2 / 2').parentElement).toHaveClass('text-danger')
  })

  it('should not count a password field', () => {
    render(<Input label="비밀번호" name="password" type="password" maxLength={72} />)

    expect(screen.queryByText('0 / 72')).not.toBeInTheDocument()
  })

  it('should keep the hint and describe the field with both', () => {
    render(<Input label="제목" name="title" maxLength={10} hint="목록에 한 줄로 보입니다." />)

    const described = screen.getByLabelText('제목').getAttribute('aria-describedby') ?? ''

    expect(described.split(' ')).toHaveLength(2)
    expect(screen.getByText('목록에 한 줄로 보입니다.')).toBeInTheDocument()
  })

  it('should not render a counter without maxLength', () => {
    render(<Input label="제목" name="title" />)

    expect(screen.queryByText(/\//u)).not.toBeInTheDocument()
  })
})

describe('Textarea 글자수', () => {
  it('should follow a controlled value', () => {
    render(<Textarea label="답변" name="answer" maxLength={100} value="가나다라" readOnly />)

    expect(screen.getByText('4 / 100')).toBeInTheDocument()
  })

  /* 문의 답변 폼은 등록에 성공하면 `form.reset()` 으로 칸을 비운다. */
  it('should fall back to zero when the owning form resets', async () => {
    const user = userEvent.setup()

    render(
      <form>
        <Textarea label="답변" name="answer" maxLength={100} />
        <button type="reset">초기화</button>
      </form>,
    )

    await user.type(screen.getByLabelText('답변'), '가나다')
    expect(screen.getByText('3 / 100')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '초기화' }))
    await screen.findByText('0 / 100')
  })
})
