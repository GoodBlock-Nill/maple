import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InquiryAttachmentField } from '@/components/support/InquiryAttachmentField'
import { INQUIRY_ATTACHMENT_REMOVE_FIELD } from '@/lib/constants/support'
import {
  INQUIRY_ATTACHMENT_MAX_COUNT,
  INQUIRY_ATTACHMENT_TOTAL_MAX_BYTES,
  INQUIRY_ATTACHMENT_TOTAL_MAX_MB,
} from '@/lib/supabase/storage'

import type { InquiryUploadResult } from '@/lib/supabase/upload-inquiry-file'

/**
 * 첨부 입력의 **고르는 순간** 검사.
 *
 * 2026-09-14 부터 이미지·PDF·영상이 모두 같은 길(브라우저 → 버킷 직접 업로드)로 가고
 * 규칙도 하나다 — 형식 불문 5개 · 합계 200MB. 여기서 보는 것은 그 규칙이 화면에서
 * 그대로 읽히는가, 그리고 어긋난 선택이 제출을 잠그는가다.
 *
 * 업로드 자체는 절대 진짜로 돌지 않는다(네트워크·세션이 없다). 진행률·취소·실패
 * 시나리오는 `InquiryAttachmentUpload.test.tsx` 가 같은 목으로 따로 본다.
 */

const started: { file: File; resolve: (result: InquiryUploadResult) => void }[] = []

vi.mock('@/lib/supabase/upload-inquiry-file', () => ({
  uploadInquiryFile: (file: File) => {
    let resolve: (result: InquiryUploadResult) => void = () => undefined
    const result = new Promise<InquiryUploadResult>((settle) => {
      resolve = settle
    })

    started.push({ file, resolve })

    return { result, abort: vi.fn() }
  },
  deleteInquiryPendingFile: vi.fn(),
}))

/** 크기만 다른 가짜 파일. jsdom 은 실제 바이트를 들고 있지 않아도 size 를 흉내 낼 수 있다. */
function fileOf(name: string, type: string, size: number): File {
  const file = new File(['x'], name, { type })

  Object.defineProperty(file, 'size', { value: size })

  return file
}

function fileInput(): HTMLInputElement {
  return screen.getByLabelText('파일 선택')
}

function existingImages(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    name: `old${index}.png`,
    path: `uid/old${index}.png`,
    size: 1024,
    mimeType: 'image/png',
  }))
}

beforeEach(() => {
  started.length = 0
})

describe('InquiryAttachmentField', () => {
  it('should state one rule for every format next to the button', () => {
    // Arrange & Act — 안내와 실제 제한이 갈리면 사용자는 "된다고 적힌 파일"을 고르고 실패한다.
    render(<InquiryAttachmentField attachments={[]} error={undefined} />)

    // Assert
    expect(
      screen.getByText(
        `이미지·PDF·영상 형식에 관계없이 최대 ${INQUIRY_ATTACHMENT_MAX_COUNT}개 · ` +
          `총 ${INQUIRY_ATTACHMENT_TOTAL_MAX_MB}MB`,
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

  it('should show how much of the shared budget is used', async () => {
    // Arrange — 상한이 하나뿐이라 "몇 개 · 얼마"를 한 줄로 읽을 수 있어야 한다.
    const user = userEvent.setup()
    render(<InquiryAttachmentField attachments={existingImages(1)} error={undefined} />)

    // Act
    await user.upload(fileInput(), fileOf('clip.mp4', 'video/mp4', 3 * 1024 * 1024))

    // Assert — 기존 1개(1KB) + 새 1개(3.0MB).
    expect(
      await screen.findByText(`2/${INQUIRY_ATTACHMENT_MAX_COUNT} · 3.0MB/200MB`),
    ).toBeInTheDocument()
  })

  it('should accept a mix of five files of any format', async () => {
    // Arrange — 예전 규칙(이미지 3 + 영상 2)이면 이 조합이 거절됐다.
    const user = userEvent.setup()
    render(<InquiryAttachmentField attachments={[]} error={undefined} />)

    // Act
    await user.upload(fileInput(), [
      fileOf('a.mp4', 'video/mp4', 1024),
      fileOf('b.mp4', 'video/mp4', 1024),
      fileOf('c.mp4', 'video/mp4', 1024),
      fileOf('d.png', 'image/png', 1024),
      fileOf('e.pdf', 'application/pdf', 1024),
    ])

    // Assert
    await waitFor(() => {
      expect(started).toHaveLength(5)
    })
    expect(screen.queryByText(/최대.*개까지/u)).not.toBeInTheDocument()
  })

  it('should reject the sixth file and lock submission', async () => {
    // Arrange
    const user = userEvent.setup()
    const onBlockedChange = vi.fn()
    render(
      <InquiryAttachmentField
        attachments={existingImages(5)}
        error={undefined}
        onBlockedChange={onBlockedChange}
      />,
    )

    // Act
    await user.upload(fileInput(), fileOf('new.png', 'image/png', 1024))

    // Assert
    expect(
      await screen.findByText(
        `첨부파일은 최대 ${INQUIRY_ATTACHMENT_MAX_COUNT}개까지 올릴 수 있습니다.`,
      ),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(onBlockedChange).toHaveBeenLastCalledWith(true)
    })
  })

  it('should count an existing attachment marked for removal as freed up', async () => {
    // Arrange — "하나 빼고 하나 넣기"는 정상 동작이라 막지 않는다.
    const user = userEvent.setup()
    render(<InquiryAttachmentField attachments={existingImages(5)} error={undefined} />)

    // Act
    await user.click(screen.getByRole('button', { name: 'old0.png 삭제' }))
    await user.upload(fileInput(), fileOf('new.png', 'image/png', 1024))

    // Assert
    expect(await screen.findByText('new.png')).toBeInTheDocument()
    expect(screen.queryByText(/최대.*개까지/u)).not.toBeInTheDocument()
  })

  it('should reject a selection over the total budget and name the limit', async () => {
    // Arrange — 파일 하나가 합계를 통째로 넘긴다.
    const user = userEvent.setup()
    render(<InquiryAttachmentField attachments={[]} error={undefined} />)

    // Act
    await user.upload(
      fileInput(),
      fileOf('huge.mp4', 'video/mp4', INQUIRY_ATTACHMENT_TOTAL_MAX_BYTES + 1),
    )

    // Assert
    expect(
      await screen.findByText(new RegExp(`huge.mp4 .*${INQUIRY_ATTACHMENT_TOTAL_MAX_MB}MB`, 'u')),
    ).toBeInTheDocument()
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

  it('should not send the picked files in the form body', async () => {
    /* Arrange — 파일이 input 에 남으면 서버 액션 본문(2mb)에 실려 나가 요청이
       액션에 닿기도 전에 끊긴다. 파일은 이미 버킷에 있다. */
    const user = userEvent.setup()
    render(<InquiryAttachmentField attachments={[]} error={undefined} />)

    // Act
    await user.upload(fileInput(), fileOf('shot.png', 'image/png', 2048))

    // Assert
    expect(fileInput().name).toBe('')
    expect(fileInput().files?.length ?? -1).toBe(0)
  })
})
