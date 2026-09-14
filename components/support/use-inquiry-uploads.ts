'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { deleteInquiryPendingFile, uploadInquiryFile } from '@/lib/supabase/upload-inquiry-file'
import { downscaleImage } from '@/lib/utils/downscale-image'
import { validateInquiryAttachments } from '@/lib/validation/inquiry-upload'

import type { InquiryUploadHandle } from '@/lib/supabase/upload-inquiry-file'
import type { PendingInquiryUpload, SizedAttachment } from '@/lib/validation/inquiry-upload'

/**
 * 첨부의 화면 상태 — 이미지 · PDF · 영상이 **모두** 여기를 지난다.
 *
 * 첨부는 폼을 제출하기 **전에** 이미 올라간다(2026-09-14 부터 형식을 가리지 않는다).
 * 그래서 이 훅이 들고 있는 것은 "고른 파일"이 아니라 "올라가는 중이거나 올라간
 * 오브젝트"다. 세 가지를 함께 쥔다.
 *
 *   * 진행률 — 200MB 를 올리는 동안 아무 표시가 없으면 멈춘 화면과 같다
 *   * 취소   — 중간에 끊고 올라간 조각까지 지운다
 *   * 잠금   — 하나라도 올라가는 중이면 제출을 막는다(첨부가 빠진 접수 방지)
 *
 * 실패한 행을 자동으로 지우지 않는 이유: 무엇이 문제였는지 보이지 않으면 사용자는
 * "왜 안 붙었지"만 남는다. 그 한 줄이 **그 행에만** 붙어야 다른 파일은 그대로 두고
 * 문제가 된 파일만 내리거나 다시 시도할 수 있다(데모 환경처럼 제공자가 우리 상한보다
 * 낮은 상한을 거는 경우가 그렇다 — 폼 전체가 멈추면 안 된다).
 */

export type InquiryUploadStatus = 'uploading' | 'done' | 'error'

export type InquiryUploadRow = {
  id: string
  name: string
  size: number
  status: InquiryUploadStatus
  /** 0~1. `uploading` 일 때만 의미가 있다. */
  progress: number
  /** 실패 사유. 성공한 행은 null. */
  message: string | null
}

type InternalRow = InquiryUploadRow & {
  /** 다시 시도할 때 같은 파일을 그대로 쓴다. */
  file: File
  /** 업로드가 끝난 오브젝트. 폼에 실리는 값이다. */
  upload: PendingInquiryUpload | null
}

export type InquiryUploadsState = {
  rows: readonly InquiryUploadRow[]
  /** 지금 잡고 있는 첨부 자리 수(올라가는 중 + 완료 + 실패). 기존 첨부는 빼고 센다. */
  count: number
  /** 지금 잡고 있는 용량(바이트). 화면의 "xxMB/200MB" 표기가 쓴다. */
  bytes: number
  /** 폼의 숨은 필드에 실을 JSON. 완료된 첨부만 담긴다. */
  value: string
  /** 하나라도 완료되지 않은 행이 있으면 제출을 잠근다. */
  isBlocked: boolean
  /** 고른 파일을 붙인다. 규칙에 어긋나 멈춘 경우 그 사유를 돌려준다. */
  addFiles: (files: readonly File[]) => Promise<string | null>
  remove: (id: string) => void
  retry: (id: string) => void
}

function toPublicRow({ id, name, size, status, progress, message }: InternalRow): InquiryUploadRow {
  return { id, name, size, status, progress, message }
}

function toCandidate(file: File) {
  return { name: file.name, type: file.type, size: file.size }
}

/**
 * 올리기 전 한 번 줄인다 — **사진만**.
 *
 * 요즘 휴대폰 사진은 한 장이 십수 MB 라, 다섯 장이면 합계 상한에 닿는다. 화면에서
 * 실제로 보이는 폭에 비하면 화질 손실은 눈에 띄지 않는다. PDF·영상은 손대지 않는다
 * (캔버스를 거칠 수 없고, 거치려는 시도 자체가 큰 파일에서 비싸다).
 */
async function prepare(file: File): Promise<File> {
  return file.type.startsWith('image/') ? downscaleImage(file) : file
}

/**
 * @param kept 수정 화면에서 그대로 두는 **기존** 첨부. 이 훅은 지금 세션에서 새로
 *   고른 것만 들고 있으므로, 개수·합계 상한을 기존 것까지 합쳐 재려면 매 렌더의
 *   최신 값을 받아야 한다. 접수 화면은 빈 배열이다.
 */
export function useInquiryUploads(kept: readonly SizedAttachment[]): InquiryUploadsState {
  const [rows, setRows] = useState<readonly InternalRow[]>([])
  /* 상태 갱신은 비동기라, 같은 이벤트 안에서 "지금 몇 개인지"를 물으려면 거울이
     필요하다(여러 파일을 한 번에 고르면 검사가 직전 파일까지의 결과를 알아야 한다). */
  const rowsRef = useRef<readonly InternalRow[]>([])
  const handlesRef = useRef(new Map<string, InquiryUploadHandle>())
  /* 렌더마다 최신 값으로 덮어쓴다 — addFiles 의 콜백은 마운트 시점 값을 닫아 두므로
     ref 를 거치지 않으면 그사이 바뀐 "삭제 표시"를 못 본다. 렌더 중이 아니라
     effect 에서 써야 한다(ref 는 렌더의 결과가 아니다 — react-hooks/refs). */
  const keptRef = useRef<readonly SizedAttachment[]>(kept)

  useEffect(() => {
    keptRef.current = kept
  }, [kept])

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
      const handle = uploadInquiryFile(file, (ratio) => {
        patchRow(id, { progress: ratio })
      })

      handlesRef.current.set(id, handle)

      void handle.result.then((result) => {
        handlesRef.current.delete(id)

        if (result.ok) {
          patchRow(id, { status: 'done', progress: 1, message: null, upload: result.upload })

          return
        }

        /* 취소는 행 자체가 이미 사라진 뒤에 도착한다. 오류로 되살리지 않는다. */
        if (!result.aborted) {
          patchRow(id, { status: 'error', message: result.message, upload: null })
        }
      })
    },
    [patchRow],
  )

  const addFiles = useCallback(
    async (files: readonly File[]): Promise<string | null> => {
      /* 줄이는 일이 먼저다 — 검사는 **실제로 올라갈 크기**로 해야 한다. */
      const prepared = await Promise.all(files.map(prepare))
      const started: InternalRow[] = []
      let message: string | null = null

      for (const file of prepared) {
        const pending = [...rowsRef.current, ...started].map((row) => toCandidate(row.file))
        const check = validateInquiryAttachments(keptRef.current, [...pending, toCandidate(file)])

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
          upload: null,
        })
      }

      if (started.length > 0) {
        applyRows((current) => [...current, ...started])

        for (const row of started) {
          start(row.id, row.file)
        }
      }

      return message
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
      if (row?.upload != null) {
        void deleteInquiryPendingFile(row.upload.path)
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

  const uploaded = rows
    .map((row) => row.upload)
    .filter((upload): upload is PendingInquiryUpload => upload !== null)

  return {
    rows: rows.map(toPublicRow),
    count: rows.length,
    bytes: rows.reduce((sum, row) => sum + row.size, 0),
    /* 빈 목록도 그대로 보낸다 — 서버는 빈 문자열과 `[]` 를 같게 읽는다. */
    value: uploaded.length === 0 ? '' : JSON.stringify(uploaded),
    isBlocked: rows.some((row) => row.status !== 'done'),
    addFiles,
    remove,
    retry,
  }
}
