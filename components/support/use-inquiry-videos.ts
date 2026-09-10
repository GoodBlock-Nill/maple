'use client'

import { useCallback, useRef, useState } from 'react'

import {
  deleteInquiryPendingVideo,
  startInquiryVideoUpload,
} from '@/lib/supabase/upload-inquiry-video'
import { validateInquiryVideo } from '@/lib/validation/inquiry-video'

import type { VideoUploadHandle } from '@/lib/supabase/upload-inquiry-video'
import type { PendingInquiryVideo } from '@/lib/validation/inquiry-video'

/**
 * 영상 첨부의 화면 상태.
 *
 * 영상은 폼을 제출하기 **전에** 이미 올라간다. 그래서 이 훅이 들고 있는 것은
 * "고른 파일"이 아니라 "올라가는 중이거나 올라간 오브젝트"다. 세 가지를 함께 쥔다.
 *
 *   * 진행률 — 100MB 를 올리는 동안 아무 표시가 없으면 멈춘 화면과 같다
 *   * 취소   — 중간에 끊고 올라간 조각까지 지운다
 *   * 잠금   — 하나라도 올라가는 중이면 제출을 막는다(첨부가 빠진 접수 방지)
 *
 * 실패한 행을 자동으로 지우지 않는 이유는 이미지 쪽과 같다 — 무엇이 문제였는지
 * 보이지 않으면 사용자는 "왜 안 붙었지"만 남는다. 다시 시도 또는 삭제로 빠져나간다.
 */

export type InquiryVideoStatus = 'uploading' | 'done' | 'error'

export type InquiryVideoRow = {
  id: string
  name: string
  size: number
  status: InquiryVideoStatus
  /** 0~1. `uploading` 일 때만 의미가 있다. */
  progress: number
  /** 실패 사유. 성공한 행은 null. */
  message: string | null
}

type InternalRow = InquiryVideoRow & {
  /** 다시 시도할 때 같은 파일을 그대로 쓴다. */
  file: File
  /** 업로드가 끝난 오브젝트. 폼에 실리는 값이다. */
  video: PendingInquiryVideo | null
}

export type AddVideosOutcome = {
  /** 규칙에 어긋나 거절된 첫 파일의 사유. 없으면 null. */
  message: string | null
  /** 실제로 업로드를 시작한 개수. 이미지 쪽 개수 계산이 이 값을 쓴다. */
  accepted: number
}

export type InquiryVideosState = {
  rows: readonly InquiryVideoRow[]
  /** 지금 잡고 있는 첨부 자리 수(올라가는 중 + 완료 + 실패). */
  count: number
  /** 폼의 숨은 필드에 실을 JSON. 완료된 영상만 담긴다. */
  value: string
  /** 하나라도 완료되지 않은 행이 있으면 제출을 잠근다. */
  isBlocked: boolean
  addFiles: (files: readonly File[], otherCount: number) => AddVideosOutcome
  remove: (id: string) => void
  retry: (id: string) => void
  removeAll: () => void
}

function toPublicRow({ id, name, size, status, progress, message }: InternalRow): InquiryVideoRow {
  return { id, name, size, status, progress, message }
}

export function useInquiryVideos(): InquiryVideosState {
  const [rows, setRows] = useState<readonly InternalRow[]>([])
  /* 상태 갱신은 비동기라, 같은 이벤트 안에서 "지금 몇 개인지"를 물으려면 거울이
     필요하다(파일 하나를 고를 때 영상 검사와 이미지 검사가 서로의 개수를 쓴다). */
  const rowsRef = useRef<readonly InternalRow[]>([])
  const handlesRef = useRef(new Map<string, VideoUploadHandle>())

  const applyRows = useCallback(
    (updater: (current: readonly InternalRow[]) => readonly InternalRow[]) => {
      rowsRef.current = updater(rowsRef.current)
      setRows(rowsRef.current)
    },
    [],
  )

  const patchRow = useCallback(
    (id: string, patch: Partial<InternalRow>) => {
      applyRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)))
    },
    [applyRows],
  )

  const start = useCallback(
    (id: string, file: File) => {
      const handle = startInquiryVideoUpload(file, (ratio) => {
        patchRow(id, { progress: ratio })
      })

      handlesRef.current.set(id, handle)

      void handle.result.then((result) => {
        handlesRef.current.delete(id)

        if (result.ok) {
          patchRow(id, { status: 'done', progress: 1, message: null, video: result.video })

          return
        }

        /* 취소는 행 자체가 이미 사라진 뒤에 도착한다. 오류로 되살리지 않는다. */
        if (!result.aborted) {
          patchRow(id, { status: 'error', message: result.message, video: null })
        }
      })
    },
    [patchRow],
  )

  const addFiles = useCallback(
    (files: readonly File[], otherCount: number): AddVideosOutcome => {
      let accepted = 0
      let message: string | null = null
      const started: InternalRow[] = []

      for (const file of files) {
        const check = validateInquiryVideo(file, {
          videoCount: rowsRef.current.length + accepted,
          otherCount,
        })

        if (!check.ok) {
          message = check.message
          break
        }

        started.push({
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          status: 'uploading',
          progress: 0,
          message: null,
          file,
          video: null,
        })
        accepted += 1
      }

      if (started.length > 0) {
        applyRows((current) => [...current, ...started])

        for (const row of started) {
          start(row.id, row.file)
        }
      }

      return { message, accepted }
    },
    [applyRows, start],
  )

  const remove = useCallback(
    (id: string) => {
      const row = rowsRef.current.find((item) => item.id === id)

      handlesRef.current.get(id)?.abort()
      handlesRef.current.delete(id)
      applyRows((current) => current.filter((item) => item.id !== id))

      /* 이미 올라간 파일은 지운다. 끊긴 전송이 남긴 조각은 업로드 쪽이 이미 지운다. */
      if (row?.video != null) {
        void deleteInquiryPendingVideo(row.video.path)
      }
    },
    [applyRows],
  )

  const retry = useCallback(
    (id: string) => {
      const row = rowsRef.current.find((item) => item.id === id)

      if (row === undefined || row.status !== 'error') {
        return
      }

      patchRow(id, { status: 'uploading', progress: 0, message: null })
      start(id, row.file)
    },
    [patchRow, start],
  )

  const removeAll = useCallback(() => {
    for (const row of rowsRef.current) {
      handlesRef.current.get(row.id)?.abort()

      if (row.video !== null) {
        void deleteInquiryPendingVideo(row.video.path)
      }
    }

    handlesRef.current.clear()
    applyRows(() => [])
  }, [applyRows])

  const uploaded = rows
    .map((row) => row.video)
    .filter((video): video is PendingInquiryVideo => video !== null)

  return {
    rows: rows.map(toPublicRow),
    count: rows.length,
    /* 빈 목록도 그대로 보낸다 — 서버는 빈 문자열과 `[]` 를 같게 읽는다. */
    value: uploaded.length === 0 ? '' : JSON.stringify(uploaded),
    isBlocked: rows.some((row) => row.status !== 'done'),
    addFiles,
    remove,
    retry,
    removeAll,
  }
}
