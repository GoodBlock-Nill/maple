import { beforeEach, describe, expect, it, vi } from 'vitest'

import { INQUIRY_VIDEO_MAX_BYTES } from '@/lib/supabase/storage'

import type { TypedSupabaseClient } from '@/lib/supabase/types'

/** 서비스 롤 클라이언트(`server-only`)를 끌고 온다. 테스트에서는 비운다. */
vi.mock('server-only', () => ({}))

const { claimPendingVideos, readPendingVideos } = await import('@/lib/actions/inquiry-videos')

/**
 * 브라우저가 직접 올린 영상을 문의 첨부로 확정하는 단계.
 *
 * 폼이 보내는 것은 사용자가 정한 문자열뿐이고, 옮기는 주체는 RLS 를 우회하는
 * 서비스 롤이다. 즉 여기의 검사가 **유일한** 경계다 — 남의 경로, 없는 오브젝트,
 * 신고와 다른 크기·형식이 전부 여기서 걸려야 한다.
 */

const USER_ID = 'aaaaaaaa-0000-4000-8000-000000000001'
const OTHER_ID = 'cccccccc-0000-4000-8000-000000000009'

type StoredItem = { name: string; metadata: Record<string, unknown> | null }

type StorageSpy = {
  client: TypedSupabaseClient
  moves: { from: string; to: string }[]
  removals: string[][]
  listedFolders: string[]
}

/** `list` 는 pending 폴더의 실제 오브젝트를, `move` 는 성공/실패를 흉내 낸다. */
function storageSpy(
  items: readonly StoredItem[],
  options: { listError?: boolean; failMoveAt?: number } = {},
): StorageSpy {
  const moves: { from: string; to: string }[] = []
  const removals: string[][] = []
  const listedFolders: string[] = []

  const client = {
    storage: {
      from: () => ({
        list: async (folder: string) => {
          listedFolders.push(folder)

          return options.listError === true
            ? { data: null, error: { message: 'storage down' } }
            : { data: [...items], error: null }
        },
        move: async (from: string, to: string) => {
          moves.push({ from, to })

          return moves.length === options.failMoveAt
            ? { data: null, error: { message: 'move failed' } }
            : { data: { message: 'ok' }, error: null }
        },
        remove: async (paths: string[]) => {
          removals.push(paths)

          return { data: [], error: null }
        },
      }),
    },
  } as unknown as TypedSupabaseClient

  return { client, moves, removals, listedFolders }
}

function videoOf(objectName: string, name = '재현영상.mp4', userId = USER_ID) {
  return { path: `${userId}/pending/${objectName}`, name, size: 1024, mimeType: 'video/mp4' }
}

function storedOf(objectName: string, size = 1024, mimetype = 'video/mp4'): StoredItem {
  return { name: objectName, metadata: { size, mimetype } }
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('claimPendingVideos', () => {
  it('should do nothing when there are no videos', async () => {
    // Arrange
    const spy = storageSpy([])

    // Act
    const result = await claimPendingVideos(spy.client, USER_ID, [])

    // Assert — 영상이 없는 접수는 스토리지를 건드리지 않는다.
    expect(result).toEqual({ ok: true, attachments: [] })
    expect(spy.listedFolders).toHaveLength(0)
  })

  it('should move the object to the accepted-attachment prefix and record storage truth', async () => {
    // Arrange — 폼이 신고한 크기·형식은 일부러 다르게 준다.
    const spy = storageSpy([storedOf('clip.mp4', 2048, 'video/quicktime')])

    // Act
    const result = await claimPendingVideos(spy.client, USER_ID, [
      { ...videoOf('clip.mp4'), size: 1, mimeType: 'video/mp4' },
    ])

    // Assert — 옮긴 자리는 기존 첨부와 같은 규칙(`<uid>/…`)이고, 메타는 스토리지 값이다.
    expect(spy.listedFolders).toEqual([`${USER_ID}/pending`])
    expect(spy.moves).toHaveLength(1)
    expect(spy.moves[0]?.from).toBe(`${USER_ID}/pending/clip.mp4`)
    expect(spy.moves[0]?.to.startsWith(`${USER_ID}/`)).toBe(true)
    expect(spy.moves[0]?.to.includes('/pending/')).toBe(false)
    expect(result).toEqual({
      ok: true,
      attachments: [
        {
          name: '재현영상.mp4',
          path: spy.moves[0]?.to,
          size: 2048,
          mimeType: 'video/quicktime',
        },
      ],
    })
  })

  it('should refuse a path under another user prefix without touching storage', async () => {
    // Arrange — 서비스 롤이 옮기므로 RLS 는 이 시도를 막지 못한다.
    const spy = storageSpy([storedOf('clip.mp4')])

    // Act
    const result = await claimPendingVideos(spy.client, USER_ID, [
      videoOf('clip.mp4', '남의영상.mp4', OTHER_ID),
    ])

    // Assert
    expect(result.ok).toBe(false)
    expect(spy.listedFolders).toHaveLength(0)
    expect(spy.moves).toHaveLength(0)
  })

  it('should refuse an already accepted attachment path', async () => {
    // Arrange — `<uid>/<파일명>` 은 접수된 첨부의 자리다. 다시 옮기게 두면 남의 문의의
    // 근거 자료를 내 문의로 끌어올 수 있다(같은 사용자의 다른 문의 포함).
    const spy = storageSpy([storedOf('clip.mp4')])

    // Act
    const result = await claimPendingVideos(spy.client, USER_ID, [
      { path: `${USER_ID}/clip.mp4`, name: 'a.mp4', size: 10, mimeType: 'video/mp4' },
    ])

    // Assert
    expect(result.ok).toBe(false)
    expect(spy.moves).toHaveLength(0)
  })

  it('should refuse a path that is not in the bucket', async () => {
    // Arrange — 올린 적 없는 경로를 지어내는 시도.
    const spy = storageSpy([])

    // Act
    const result = await claimPendingVideos(spy.client, USER_ID, [videoOf('ghost.mp4')])

    // Assert
    expect(result.ok).toBe(false)
    expect(spy.moves).toHaveLength(0)
  })

  it('should refuse an object whose stored mime type is not a video', async () => {
    // Arrange — 폼은 video/mp4 라고 신고하지만 실제로 올라간 것은 실행 파일이다.
    const spy = storageSpy([storedOf('clip.mp4', 1024, 'application/octet-stream')])

    // Act
    const result = await claimPendingVideos(spy.client, USER_ID, [videoOf('clip.mp4')])

    // Assert
    expect(result.ok).toBe(false)
    expect(spy.moves).toHaveLength(0)
  })

  it('should refuse an object larger than the limit no matter what the form claims', async () => {
    // Arrange — 신고 값을 믿으면 100MB 제한이 "작다고 적어 보내면 통과"가 된다.
    const spy = storageSpy([storedOf('big.mp4', INQUIRY_VIDEO_MAX_BYTES + 1)])

    // Act
    const result = await claimPendingVideos(spy.client, USER_ID, [
      { ...videoOf('big.mp4'), size: 10 },
    ])

    // Assert
    expect(result.ok).toBe(false)
    expect(spy.moves).toHaveLength(0)
  })

  it('should fail when the existence check itself is broken', async () => {
    // Arrange — 목록을 못 읽었는데 옮기면 검사 없이 통과시키는 것과 같다.
    const spy = storageSpy([storedOf('clip.mp4')], { listError: true })

    // Act
    const result = await claimPendingVideos(spy.client, USER_ID, [videoOf('clip.mp4')])

    // Assert
    expect(result.ok).toBe(false)
    expect(spy.moves).toHaveLength(0)
  })

  it('should delete already moved objects when a later move fails', async () => {
    // Arrange — 반쯤 확정된 상태로 두면 어떤 문의도 참조하지 않는 파일이 남는다.
    const spy = storageSpy([storedOf('one.mp4'), storedOf('two.mp4')], { failMoveAt: 2 })

    // Act
    const result = await claimPendingVideos(spy.client, USER_ID, [
      videoOf('one.mp4', '첫번째.mp4'),
      videoOf('two.mp4', '두번째.mp4'),
    ])

    // Assert — 옮긴 것만 지운다. pending 에 남은 것은 다시 제출하면 그대로 쓰인다.
    expect(result.ok).toBe(false)
    expect(spy.removals).toEqual([[spy.moves[0]?.to]])
  })
})

describe('readPendingVideos', () => {
  it('should read an absent field as no videos', () => {
    // Arrange & Act & Assert — 영상을 안 붙인 접수가 대부분이다.
    expect(readPendingVideos(new FormData())).toEqual([])
  })

  it('should return null for a malformed field', () => {
    // Arrange
    const formData = new FormData()
    formData.set('videoAttachments', '[{"path":1}]')

    // Act & Assert — 조용히 빈 목록으로 삼키면 영상이 빠진 문의가 접수된다.
    expect(readPendingVideos(formData)).toBeNull()
  })
})
