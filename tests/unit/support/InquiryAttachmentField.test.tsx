import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { InquiryAttachmentField } from '@/components/support/InquiryAttachmentField'
import {
  INQUIRY_ATTACHMENT_MAX_BYTES,
  INQUIRY_ATTACHMENT_MAX_MB,
  INQUIRY_ATTACHMENT_TOTAL_MAX_MB,
} from '@/lib/supabase/storage'

/**
 * 첨부 입력의 **보내기 전** 검사.
 *
 * 서버 액션 본문 상한을 넘긴 요청은 액션에 닿지 않아 아무 문구도 돌려줄 수 없다
 * (사용자는 "A server error occurred" 화면을 보고 입력을 통째로 잃는다).
 * 그래서 이 검사는 UX 편의가 아니라 실패를 막는 유일한 지점이다.
 */

/** 크기만 다른 가짜 파일. jsdom 은 실제 바이트를 들고 있지 않아도 size 를 흉내 낼 수 있다. */
function fileOf(name: string, type: string, size: number): File {
  const file = new File(['x'], name, { type })

  Object.defineProperty(file, 'size', { value: size })

  return file
}

function fileInput(): HTMLInputElement {
  return screen.getByLabelText('파일 선택')
}

describe('InquiryAttachmentField', () => {
  it('should state the real limits next to the label', () => {
    // Arrange & Act — 안내와 실제 제한이 갈리면 사용자는 "된다고 적힌 파일"을 고르고 실패한다.
    render(<InquiryAttachmentField attachments={[]} error={undefined} />)

    // Assert
    expect(
      screen.getByText(
        new RegExp(`각 ${INQUIRY_ATTACHMENT_MAX_MB}MB · 합계 ${INQUIRY_ATTACHMENT_TOTAL_MAX_MB}MB`),
      ),
    ).toBeInTheDocument()
  })

  it('should list a selected file with its size', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<InquiryAttachmentField attachments={[]} error={undefined} />)

    // Act
    await user.upload(fileInput(), fileOf('shot.png', 'image/png', 2048))

    // Assert — 이름이 보이지 않으면 첨부됐는지 알 수 없다.
    expect(await screen.findByText('shot.png')).toBeInTheDocument()
  })

  it('should reject a file over the per-file limit and lock submission', async () => {
    // Arrange
    const user = userEvent.setup()
    const onBlockedChange = vi.fn()
    render(
      <InquiryAttachmentField
        attachments={[]}
        error={undefined}
        onBlockedChange={onBlockedChange}
      />,
    )

    // Act
    await user.upload(
      fileInput(),
      fileOf('photo.jpg', 'image/jpeg', INQUIRY_ATTACHMENT_MAX_BYTES + 1),
    )

    // Assert — 어느 파일이 문제인지 한국어로 알려 주고, 첨부가 조용히 빠진 접수를 막는다.
    expect(
      await screen.findByText(new RegExp(`photo.jpg .*${INQUIRY_ATTACHMENT_MAX_MB}MB`)),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(onBlockedChange).toHaveBeenLastCalledWith(true)
    })
  })

  it('should unlock submission when the bad selection is cleared', async () => {
    // Arrange — 첨부를 포기하는 길이 없으면 잠긴 폼에서 빠져나올 수 없다.
    const user = userEvent.setup()
    const onBlockedChange = vi.fn()
    render(
      <InquiryAttachmentField
        attachments={[]}
        error={undefined}
        onBlockedChange={onBlockedChange}
      />,
    )
    await user.upload(
      fileInput(),
      fileOf('photo.jpg', 'image/jpeg', INQUIRY_ATTACHMENT_MAX_BYTES + 1),
    )

    // Act
    await user.click(await screen.findByRole('button', { name: '첨부 지우기' }))

    /* Assert — 파일 목록 자체가 비는지는 브라우저 동작이라 e2e
       (`tests/e2e/support-inquiries.spec.ts`)가 본다. 여기서는 화면과 잠금을 본다. */
    expect(screen.queryByText(/photo.jpg/u)).not.toBeInTheDocument()
    await waitFor(() => {
      expect(onBlockedChange).toHaveBeenLastCalledWith(false)
    })
  })

  it('should reject a fourth file when three are already attached', async () => {
    // Arrange — 개수 제한은 DB CHECK(`inquiries_attachments_max_3`)와 같아야 한다.
    const user = userEvent.setup()
    const existing = [1, 2, 3].map((index) => ({
      name: `old${index}.png`,
      path: `uid/old${index}.png`,
      size: 1024,
      mimeType: 'image/png',
    }))
    render(<InquiryAttachmentField attachments={existing} error={undefined} />)

    // Act
    await user.upload(fileInput(), fileOf('new.png', 'image/png', 1024))

    // Assert
    expect(await screen.findByText('첨부파일은 최대 3개까지 올릴 수 있습니다.')).toBeInTheDocument()
  })

  it('should count an existing attachment marked for removal as freed up', async () => {
    // Arrange — "하나 빼고 하나 넣기"는 정상 동작이라 막지 않는다.
    const user = userEvent.setup()
    const existing = [1, 2, 3].map((index) => ({
      name: `old${index}.png`,
      path: `uid/old${index}.png`,
      size: 1024,
      mimeType: 'image/png',
    }))
    render(<InquiryAttachmentField attachments={existing} error={undefined} />)

    // Act
    await user.click(screen.getAllByRole('checkbox')[0] as HTMLElement)
    await user.upload(fileInput(), fileOf('new.png', 'image/png', 1024))

    // Assert
    expect(await screen.findByText('new.png')).toBeInTheDocument()
    expect(screen.queryByText('첨부파일은 최대 3개까지 올릴 수 있습니다.')).not.toBeInTheDocument()
  })

  it('should lock submission while it prepares the files', async () => {
    // Arrange
    const user = userEvent.setup()
    const onBlockedChange = vi.fn()
    render(
      <InquiryAttachmentField
        attachments={[]}
        error={undefined}
        onBlockedChange={onBlockedChange}
      />,
    )

    // Act
    await user.upload(fileInput(), fileOf('shot.png', 'image/png', 2048))

    // Assert — 준비가 끝나면 다시 열린다(잠금이 남으면 접수 자체가 막힌다).
    await waitFor(() => {
      expect(onBlockedChange).toHaveBeenLastCalledWith(false)
    })
    expect(onBlockedChange).toHaveBeenCalledWith(true)
  })

  it('should keep showing the server-side error until a new pick', () => {
    // Arrange & Act — 액션이 돌려준 문구도 같은 자리에 그린다.
    render(<InquiryAttachmentField attachments={[]} error="첨부파일을 올리지 못했습니다." />)

    // Assert
    expect(screen.getByText('첨부파일을 올리지 못했습니다.')).toBeInTheDocument()
  })
})
