import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InquiryAttachmentField } from '@/components/support/InquiryAttachmentField'

import type { VideoUploadResult } from '@/lib/supabase/upload-inquiry-video'

/**
 * 영상 첨부의 화면 상태.
 *
 * 영상은 제출 전에 이미 전송이 시작되므로, 이미지와 달리 "고른 파일 목록"이 아니라
 * **진행 중인 작업**을 그린다. 진행률이 안 보이거나 취소가 없으면 100MB 를 올리는
 * 동안의 화면은 멈춘 화면과 구별되지 않고, 업로드 중에 제출이 열려 있으면 첨부가
 * 조용히 빠진 문의가 접수된다.
 */

type Deferred = {
  resolve: (result: VideoUploadResult) => void
  onProgress: (ratio: number) => void
  abort: ReturnType<typeof vi.fn>
}

const started: Deferred[] = []
const deleteInquiryPendingVideo = vi.fn()

vi.mock('@/lib/supabase/upload-inquiry-video', () => ({
  startInquiryVideoUpload: (_file: File, onProgress: (ratio: number) => void) => {
    let resolve: (result: VideoUploadResult) => void = () => undefined
    const result = new Promise<VideoUploadResult>((settle) => {
      resolve = settle
    })
    const abort = vi.fn()

    started.push({ resolve, onProgress, abort })

    return { result, abort }
  },
  deleteInquiryPendingVideo: (path: string) => deleteInquiryPendingVideo(path),
}))

function videoFile(name = 'clip.mp4', size = 4 * 1024 * 1024): File {
  const file = new File(['video-bytes'], name, { type: 'video/mp4' })

  Object.defineProperty(file, 'size', { value: size })

  return file
}

function fileInput(): HTMLInputElement {
  return screen.getByLabelText('파일 선택')
}

function hiddenField(): HTMLInputElement {
  const field = document.querySelector<HTMLInputElement>('input[name="videoAttachments"]')

  if (field === null) {
    throw new Error('영상 목록을 실어 보낼 숨은 필드가 없습니다.')
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

beforeEach(() => {
  started.length = 0
  deleteInquiryPendingVideo.mockReset()
})

describe('InquiryAttachmentField (영상)', () => {
  it('should start uploading as soon as a video is picked and lock submission', async () => {
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

  it('should show the transfer progress while it uploads', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<InquiryAttachmentField attachments={[]} error={undefined} />)
    await user.upload(fileInput(), videoFile())

    // Act
    act(() => {
      latest().onProgress(0.42)
    })

    // Assert — 100MB 를 올리는 동안 표시가 없으면 멈춘 화면과 같다.
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
        video: {
          path: 'uid/pending/abc.mp4',
          name: 'clip.mp4',
          size: 4 * 1024 * 1024,
          mimeType: 'video/mp4',
        },
      })
    })

    // Assert — 서버는 이 숨은 필드만 보고 영상 첨부를 확정한다.
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
    await user.click(screen.getByRole('button', { name: '업로드 취소' }))

    // Assert — 잠긴 폼에서 빠져나오는 길이 없으면 접수 자체가 막힌다.
    expect(upload.abort).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('clip.mp4')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(onBlockedChange).toHaveBeenLastCalledWith(false)
    })
  })

  it('should delete the object when a finished video is removed', async () => {
    // Arrange — 목록에서 뺀 영상이 버킷에 남으면 아무도 참조하지 않는 100MB 가 쌓인다.
    const user = userEvent.setup()
    render(<InquiryAttachmentField attachments={[]} error={undefined} />)
    await user.upload(fileInput(), videoFile())
    act(() => {
      latest().resolve({
        ok: true,
        video: { path: 'uid/pending/abc.mp4', name: 'clip.mp4', size: 10, mimeType: 'video/mp4' },
      })
    })
    await screen.findByText('첨부 완료')

    // Act
    await user.click(screen.getByRole('button', { name: '삭제' }))

    // Assert
    expect(deleteInquiryPendingVideo).toHaveBeenCalledWith('uid/pending/abc.mp4')
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
      latest().resolve({ ok: false, aborted: false, message: '영상을 올리지 못했습니다.' })
    })

    // Assert — 실패를 조용히 지우면 사용자에게는 "왜 안 붙었지"만 남는다.
    expect(await screen.findByText('영상을 올리지 못했습니다.')).toBeInTheDocument()
    await waitFor(() => {
      expect(onBlockedChange).toHaveBeenLastCalledWith(true)
    })

    // Act — 다시 시도하면 같은 파일로 전송을 새로 건다.
    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    // Assert
    expect(started).toHaveLength(2)
    expect(screen.getByText('올리는 중 0%')).toBeInTheDocument()
  })

  it('should refuse a third video and explain the video-only limit', async () => {
    // Arrange — 전체 3개를 영상만으로 채우면 재현 화면과 영상을 함께 낼 수 없다.
    const user = userEvent.setup()
    render(<InquiryAttachmentField attachments={[]} error={undefined} />)

    // Act
    await user.upload(fileInput(), [videoFile('a.mp4'), videoFile('b.mp4'), videoFile('c.mp4')])

    // Assert
    expect(await screen.findByText('영상은 최대 2개까지 올릴 수 있습니다.')).toBeInTheDocument()
    expect(started).toHaveLength(2)
  })

  it('should count existing attachments against the overall limit', async () => {
    // Arrange — 이미 3개면 영상을 넣을 자리가 없다(DB CHECK 와 같은 숫자).
    const user = userEvent.setup()
    const existing = [1, 2, 3].map((index) => ({
      name: `old${index}.png`,
      path: `uid/old${index}.png`,
      size: 1024,
      mimeType: 'image/png',
    }))
    render(<InquiryAttachmentField attachments={existing} error={undefined} />)

    // Act
    await user.upload(fileInput(), videoFile())

    // Assert
    expect(await screen.findByText('첨부파일은 최대 3개까지 올릴 수 있습니다.')).toBeInTheDocument()
    expect(started).toHaveLength(0)
  })
})
