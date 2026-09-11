import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { InquiryAttachmentField } from '@/components/support/InquiryAttachmentField'
import { INQUIRY_ATTACHMENT_REMOVE_FIELD } from '@/lib/constants/support'
import {
  INQUIRY_ATTACHMENT_MAX_BYTES,
  INQUIRY_ATTACHMENT_MAX_MB,
  INQUIRY_ATTACHMENT_TOTAL_MAX_MB,
  INQUIRY_FILE_MAX_COUNT,
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
  it('should state the real limits next to the button', () => {
    // Arrange & Act — 안내와 실제 제한이 갈리면 사용자는 "된다고 적힌 파일"을 고르고 실패한다.
    render(<InquiryAttachmentField attachments={[]} error={undefined} />)

    // Assert
    expect(
      screen.getByText(
        new RegExp(
          `이미지·PDF ${INQUIRY_ATTACHMENT_MAX_MB}MB/개 · 최대 ${INQUIRY_FILE_MAX_COUNT}개 · ` +
            `총 ${INQUIRY_ATTACHMENT_TOTAL_MAX_MB}MB`,
        ),
      ),
    ).toBeInTheDocument()
  })

  it('should list the accepted formats under the limits', () => {
    // Arrange & Act — 형식을 적지 않으면 사용자는 고를 수 없는 파일을 먼저 시도한다.
    render(<InquiryAttachmentField attachments={[]} error={undefined} />)

    // Assert
    expect(screen.getByText(/JPG.*PDF.*MP4/u)).toBeInTheDocument()
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

  it('should unlock submission when the bad chip is removed', async () => {
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

    // Act — 칩의 X 가 어긋난 선택에서 빠져나오는 길이다.
    await user.click(await screen.findByRole('button', { name: 'photo.jpg 첨부 해제' }))

    /* Assert — 파일 목록 자체가 비는지는 브라우저 동작이라 e2e
       (`tests/e2e/support-inquiries.spec.ts`)가 본다. 여기서는 화면과 잠금을 본다. */
    expect(screen.queryByText(/photo.jpg/u)).not.toBeInTheDocument()
    await waitFor(() => {
      expect(onBlockedChange).toHaveBeenLastCalledWith(false)
    })
  })

  it('should reject a fourth file when three are already attached', async () => {
    // Arrange — 개수 제한은 DB CHECK(`inquiries_attachments_file_kind_max_3`)와 같아야 한다.
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
    expect(
      await screen.findByText(
        `이미지·PDF는 최대 ${INQUIRY_FILE_MAX_COUNT}개까지 첨부할 수 있습니다.`,
      ),
    ).toBeInTheDocument()
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
    await user.click(screen.getByRole('button', { name: 'old1.png 삭제' }))
    await user.upload(fileInput(), fileOf('new.png', 'image/png', 1024))

    // Assert
    expect(await screen.findByText('new.png')).toBeInTheDocument()
    expect(
      screen.queryByText(`이미지·PDF는 최대 ${INQUIRY_FILE_MAX_COUNT}개까지 첨부할 수 있습니다.`),
    ).not.toBeInTheDocument()
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

  it('should submit the removed attachment path as a hidden value', async () => {
    /* 칩의 X 는 파일을 즉시 지우지 않는다 — 저장하지 않고 떠난 사용자의 파일이
       사라지면 안 되기 때문이다. 대신 "뺄 것"을 폼 전송값으로 남긴다. */
    // Arrange
    const user = userEvent.setup()

    const { container } = render(
      <InquiryAttachmentField
        attachments={[{ name: 'old.png', path: 'uid/old.png', size: 1024, mimeType: 'image/png' }]}
        error={undefined}
      />,
    )

    // Assert — 표시하기 전에는 전송값이 없다.
    const removedInputs = () =>
      container.querySelectorAll(`input[name="${INQUIRY_ATTACHMENT_REMOVE_FIELD}"]`)

    expect(removedInputs()).toHaveLength(0)

    // Act
    await user.click(screen.getByRole('button', { name: 'old.png 삭제' }))

    // Assert — 칩은 사라지고 오브젝트 키가 숨은 입력으로 남는다.
    expect(screen.queryByText('old.png')).not.toBeInTheDocument()
    expect(removedInputs()).toHaveLength(1)
    expect((removedInputs()[0] as HTMLInputElement).value).toBe('uid/old.png')
  })
})
