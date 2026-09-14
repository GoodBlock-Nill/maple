import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InquiryAttachmentField } from '@/components/support/InquiryAttachmentField'

import type { InquiryUploadResult } from '@/lib/supabase/upload-inquiry-file'

/**
 * 업로드 중인 첨부의 화면 상태 — 이미지 · PDF · 영상이 모두 같다(2026-09-14).
 *
 * 첨부는 제출 전에 이미 전송이 시작되므로, 화면은 "고른 파일 목록"이 아니라 **진행
 * 중인 작업**을 그린다. 진행률이 안 보이거나 취소가 없으면 큰 파일을 올리는 동안의
 * 화면은 멈춘 화면과 구별되지 않고, 업로드 중에 제출이 열려 있으면 첨부가 조용히
 * 빠진 문의가 접수된다.
 *
 * 실패는 **그 칩에만** 붙어야 한다. 데모 환경처럼 제공자가 우리 상한(200MB)보다
 * 낮은 상한을 걸면 어떤 파일은 반드시 거절되는데, 그때 폼 전체가 멈추면 사용자는
 * 문의 자체를 낼 수 없다.
 */

type Deferred = {
  resolve: (result: InquiryUploadResult) => void
  onProgress: (ratio: number) => void
  abort: ReturnType<typeof vi.fn>
}

const started: Deferred[] = []
const deleteInquiryPendingFile = vi.fn()

vi.mock('@/lib/supabase/upload-inquiry-file', () => ({
  uploadInquiryFile: (_file: File, onProgress: (ratio: number) => void) => {
    let resolve: (result: InquiryUploadResult) => void = () => undefined
    const result = new Promise<InquiryUploadResult>((settle) => {
      resolve = settle
    })
    const abort = vi.fn()

    started.push({ resolve, onProgress, abort })

    return { result, abort }
  },
  deleteInquiryPendingFile: (path: string) => deleteInquiryPendingFile(path),
}))

function videoFile(name = 'clip.mp4', size = 4 * 1024 * 1024): File {
  const file = new File(['video-bytes'], name, { type: 'video/mp4' })

  Object.defineProperty(file, 'size', { value: size })

  return file
}

function imageFile(name = 'shot.png', size = 1024): File {
  const file = new File(['png-bytes'], name, { type: 'image/png' })

  Object.defineProperty(file, 'size', { value: size })

  return file
}

function fileInput(): HTMLInputElement {
  return screen.getByLabelText('파일 선택')
}

function hiddenField(): HTMLInputElement {
  const field = document.querySelector<HTMLInputElement>('input[name="pendingAttachments"]')

  if (field === null) {
    throw new Error('첨부 목록을 실어 보낼 숨은 필드가 없습니다.')
  }

  return field
}

/** 마지막으로 시작된 업로드. 테스트가 완료·실패 시점을 직접 정한다. */
function latest(): Deferred {
  const upload = started[started.length - 1]

  if (upload === undefined) {
    throw new Error('업로드가 시작되지 않았습니다.')
  }

  return upload
}

function uploadOf(path: string, name: string, mimeType: string): InquiryUploadResult {
  return { ok: true, upload: { path, name, size: 1024, mimeType } }
}

beforeEach(() => {
  started.length = 0
  deleteInquiryPendingFile.mockReset()
})

describe('InquiryAttachmentField (업로드)', () => {
  it('should start uploading as soon as a file is picked and lock submission', async () => {
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
    await user.upload(fileInput(), videoFile())

    // Assert — 이름·크기·진행률이 보이고, 끝날 때까지 제출은 잠긴다.
    expect(await screen.findByText('clip.mp4')).toBeInTheDocument()
    expect(screen.getByText('올리는 중 0%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    expect(started).toHaveLength(1)
    await waitFor(() => {
      expect(onBlockedChange).toHaveBeenLastCalledWith(true)
    })
  })

  it('should upload images through the same path as videos', async () => {
    // Arrange — 예전에는 이미지만 서버 액션 본문으로 갔다(2026-09-14 통합).
    const user = userEvent.setup()
    render(<InquiryAttachmentField attachments={[]} error={undefined} />)

    // Act
    await user.upload(fileInput(), imageFile())

    // Assert
    expect(await screen.findByText('shot.png')).toBeInTheDocument()
    expect(started).toHaveLength(1)
  })

  it('should show the transfer progress while it uploads', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<InquiryAttachmentField attachments={[]} error={undefined} />)
    await user.upload(fileInput(), videoFile())

    // Act
    act(() => {
      latest().onProgress(0.42)
    })

    // Assert — 큰 파일을 올리는 동안 표시가 없으면 멈춘 화면과 같다.
    expect(screen.getByText('올리는 중 42%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42')
  })

  it('should hand the uploaded object to the form and unlock submission', async () => {
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
    await user.upload(fileInput(), videoFile())

    // Act
    act(() => {
      latest().resolve({
        ok: true,
        upload: {
          path: 'uid/pending/abc.mp4',
          name: 'clip.mp4',
          size: 4 * 1024 * 1024,
          mimeType: 'video/mp4',
        },
      })
    })

    // Assert — 서버는 이 숨은 필드만 보고 첨부를 확정한다.
    expect(await screen.findByText('첨부 완료')).toBeInTheDocument()
    await waitFor(() => {
      expect(JSON.parse(hiddenField().value)).toEqual([
        {
          path: 'uid/pending/abc.mp4',
          name: 'clip.mp4',
          size: 4 * 1024 * 1024,
          mimeType: 'video/mp4',
        },
      ])
    })
    await waitFor(() => {
      expect(onBlockedChange).toHaveBeenLastCalledWith(false)
    })
  })

  it('should abort the transfer and drop the row when the upload is cancelled', async () => {
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
    await user.upload(fileInput(), videoFile())
    const upload = latest()

    // Act
    await user.click(screen.getByRole('button', { name: 'clip.mp4 업로드 취소' }))

    // Assert — 잠긴 폼에서 빠져나오는 길이 없으면 접수 자체가 막힌다.
    expect(upload.abort).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('clip.mp4')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(onBlockedChange).toHaveBeenLastCalledWith(false)
    })
  })

  it('should delete the object when a finished attachment is removed', async () => {
    // Arrange — 목록에서 뺀 파일이 버킷에 남으면 아무도 참조하지 않는 오브젝트가 쌓인다.
    const user = userEvent.setup()
    render(<InquiryAttachmentField attachments={[]} error={undefined} />)
    await user.upload(fileInput(), videoFile())
    act(() => {
      latest().resolve(uploadOf('uid/pending/abc.mp4', 'clip.mp4', 'video/mp4'))
    })
    await screen.findByText('첨부 완료')

    // Act
    await user.click(screen.getByRole('button', { name: 'clip.mp4 첨부 해제' }))

    // Assert
    expect(deleteInquiryPendingFile).toHaveBeenCalledWith('uid/pending/abc.mp4')
    expect(hiddenField().value).toBe('')
  })

  it('should keep a failed upload visible with a retry and stay locked', async () => {
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
    await user.upload(fileInput(), videoFile())

    // Act
    act(() => {
      latest().resolve({
        ok: false,
        aborted: false,
        message: '파일을 올리지 못했습니다. 크기를 줄이거나 다른 파일을 선택해 주세요.',
      })
    })

    // Assert — 실패를 조용히 지우면 사용자에게는 "왜 안 붙었지"만 남는다.
    expect(await screen.findByText(/파일을 올리지 못했습니다/u)).toBeInTheDocument()
    await waitFor(() => {
      expect(onBlockedChange).toHaveBeenLastCalledWith(true)
    })

    // Act — 다시 시도하면 같은 파일로 전송을 새로 건다.
    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    // Assert
    expect(started).toHaveLength(2)
    expect(screen.getByText('올리는 중 0%')).toBeInTheDocument()
  })

  it('should keep the other attachments when one file is refused by storage', async () => {
    /* Arrange — 데모 환경은 제공자 상한이 우리 상한보다 낮아 큰 파일이 413 으로
       거절될 수 있다. 그 한 건 때문에 폼이 멈추면 문의 자체를 낼 수 없다. */
    const user = userEvent.setup()
    const onBlockedChange = vi.fn()
    render(
      <InquiryAttachmentField
        attachments={[]}
        error={undefined}
        onBlockedChange={onBlockedChange}
      />,
    )
    await user.upload(fileInput(), [imageFile('ok.png'), videoFile('too-big.mp4')])

    // Act — 작은 파일은 성공, 큰 파일은 거절.
    act(() => {
      started[0]?.resolve(uploadOf('uid/pending/ok.png', 'ok.png', 'image/png'))
      started[1]?.resolve({
        ok: false,
        aborted: false,
        message: '파일을 올리지 못했습니다. 크기를 줄이거나 다른 파일을 선택해 주세요.',
      })
    })
    await screen.findByText(/파일을 올리지 못했습니다/u)

    // Act — 문제가 된 칩만 내린다.
    await user.click(screen.getByRole('button', { name: 'too-big.mp4 첨부 해제' }))

    // Assert — 먼저 올라간 파일은 그대로 남고 제출이 다시 열린다.
    expect(screen.getByText('ok.png')).toBeInTheDocument()
    expect(JSON.parse(hiddenField().value)).toHaveLength(1)
    await waitFor(() => {
      expect(onBlockedChange).toHaveBeenLastCalledWith(false)
    })
  })

  it('should refuse a sixth file while five uploads are already going', async () => {
    // Arrange — 개수는 올라가는 중인 것까지 함께 센다.
    const user = userEvent.setup()
    render(<InquiryAttachmentField attachments={[]} error={undefined} />)

    // Act
    await user.upload(fileInput(), [
      imageFile('a.png'),
      imageFile('b.png'),
      imageFile('c.png'),
      videoFile('d.mp4'),
      videoFile('e.mp4'),
      videoFile('f.mp4'),
    ])

    // Assert — 다섯 개까지만 전송이 시작되고, 여섯 번째에서 문구가 뜬다.
    expect(await screen.findByText('첨부파일은 최대 5개까지 올릴 수 있습니다.')).toBeInTheDocument()
    expect(started).toHaveLength(5)
  })
})
