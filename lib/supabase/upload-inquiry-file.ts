import { createClient } from '@/lib/supabase/client'
import { buildInquiryPendingPath, STORAGE_BUCKETS } from '@/lib/supabase/storage'
import {
  INQUIRY_ATTACHMENT_MIME_EXTENSIONS,
  isInquiryAttachmentMime,
} from '@/lib/validation/inquiry-upload'

import type { PendingInquiryUpload } from '@/lib/validation/inquiry-upload'

/**
 * 문의 첨부의 **브라우저 직접 업로드** — 이미지 · PDF · 영상이 모두 이 길로 간다.
 *
 * 예전에는 이미지만 서버 액션 본문(`multipart/form-data`)에 실어 보냈다. 그래서
 * 본문 상한이 곧 이미지 상한이었고("각 5MB · 합계 12MB"), 영상만 따로 이 길을 썼다.
 * 2026-09-14 부터 규칙이 형식과 무관해지면서(총 5개 · 200MB) 길도 하나로 합쳤다 —
 * 200MB 를 본문으로 받는 선택지는 없다. 상한을 올리면 **모든** 서버 액션이 그만큼의
 * 메모리를 한 요청에 받아 낼 수 있게 되고, 그래도 파일은 결국 서버를 한 번 더 거쳐
 * 스토리지로 간다.
 *
 * 서명 업로드 URL(`createSignedUploadUrl`)을 한 번 받아 XHR 로 PUT 한다. supabase-js
 * 의 `upload()` 를 그대로 쓰지 않는 이유는 두 가지다 — fetch 기반이라 (1) 진행률을
 * 알 수 없고 (2) 중간에 끊을 수 없다. 큰 파일을 올리는 동안 아무 표시도 없고 취소도
 * 못 하는 화면은 "멈춘 화면"과 구별되지 않는다.
 *
 * 서명 URL 발급 자체가 `inquiry_attachments_insert_own` 정책을 탄다. 즉 남의 uid
 * 로 시작하는 경로는 여기서 이미 거절된다(URL 이 발급되지 않는다).
 */

/** supabase-js 가 붙이는 값과 같게 둔다. 비공개 버킷이라 실제로 캐시되지는 않는다. */
const CACHE_CONTROL = '3600'

const OK_STATUS_MIN = 200
const OK_STATUS_MAX = 300

/**
 * 전송 실패 문구.
 *
 * 스토리지가 거절하는 이유는 한 가지가 아니다(용량 초과 413 · 형식 400 · 서명 만료
 * 403 · 네트워크 끊김). 사용자가 화면에서 할 수 있는 일은 어느 쪽이든 같으므로 —
 * 파일을 줄이거나 다른 파일을 고르거나 다시 시도 — 한 문장으로 합친다. 특히 데모
 * 환경처럼 제공자가 우리 상한(200MB)보다 낮은 상한을 거는 경우가 있는데, 그때도
 * **그 파일만** 실패하고 나머지 첨부와 폼은 그대로 살아 있어야 한다.
 */
export const UPLOAD_FAILURE_MESSAGE =
  '파일을 올리지 못했습니다. 크기를 줄이거나 다른 파일을 선택해 주세요.'

const LOGIN_REQUIRED_MESSAGE = '로그인 후 이용할 수 있습니다.'

const UNSUPPORTED_MESSAGE =
  '이미지(JPG, PNG, GIF, WEBP) · PDF · 영상(MP4, MOV, WEBM, M4V) 파일만 올릴 수 있습니다.'

export type InquiryUploadResult =
  | { ok: true; upload: PendingInquiryUpload }
  /** 사용자가 취소했다. 화면은 행을 지우고 오류를 그리지 않는다. */
  | { ok: false; aborted: true }
  | { ok: false; aborted: false; message: string }

export type InquiryUploadHandle = {
  result: Promise<InquiryUploadResult>
  /**
   * 진행 중인 전송을 끊는다. 이미 끝난 뒤에 불러도 안전하다 —
   * 그 경우 호출자가 `deleteInquiryPendingFile` 로 올라간 파일을 지운다.
   */
  abort: () => void
}

/** XHR 은 만들어지기 전에도 취소될 수 있다(서명 URL 을 기다리는 동안). */
type AbortState = { xhr: XMLHttpRequest | null; isAborted: boolean }

type PutOutcome = { ok: true } | { ok: false; aborted: boolean }

function put(
  url: string,
  file: File,
  onProgress: (ratio: number) => void,
  state: AbortState,
): Promise<PutOutcome> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()

    state.xhr = xhr
    xhr.open('PUT', url, true)
    /* 같은 경로에 두 번 쓰는 일은 없어야 한다(uuid 경로라 충돌 자체가 버그 신호다). */
    xhr.setRequestHeader('x-upsert', 'false')

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(event.loaded / event.total)
      }
    })

    xhr.addEventListener('load', () => {
      resolve(
        xhr.status >= OK_STATUS_MIN && xhr.status < OK_STATUS_MAX
          ? { ok: true }
          : { ok: false, aborted: false },
      )
    })
    xhr.addEventListener('error', () => resolve({ ok: false, aborted: false }))
    xhr.addEventListener('timeout', () => resolve({ ok: false, aborted: false }))
    xhr.addEventListener('abort', () => resolve({ ok: false, aborted: true }))

    /* supabase-js 의 브라우저 경로와 같은 모양으로 보낸다(Blob → multipart, 필드명은
       빈 문자열). 모양이 다르면 스토리지가 본문을 파일로 읽지 못한다. */
    const body = new FormData()

    body.append('cacheControl', CACHE_CONTROL)
    body.append('', file)

    xhr.send(body)
  })
}

async function run(
  file: File,
  onProgress: (ratio: number) => void,
  state: AbortState,
): Promise<InquiryUploadResult> {
  if (!isInquiryAttachmentMime(file.type)) {
    return { ok: false, aborted: false, message: UNSUPPORTED_MESSAGE }
  }

  const supabase = createClient()
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id ?? ''

  if (userId === '') {
    return { ok: false, aborted: false, message: LOGIN_REQUIRED_MESSAGE }
  }

  const path = buildInquiryPendingPath({
    userId,
    id: crypto.randomUUID(),
    extension: INQUIRY_ATTACHMENT_MIME_EXTENSIONS[file.type],
  })

  const signed = await supabase.storage
    .from(STORAGE_BUCKETS.inquiryAttachments)
    .createSignedUploadUrl(path)

  if (state.isAborted) {
    return { ok: false, aborted: true }
  }

  if (signed.error !== null || signed.data === null) {
    return { ok: false, aborted: false, message: UPLOAD_FAILURE_MESSAGE }
  }

  const outcome = await put(signed.data.signedUrl, file, onProgress, state)

  if (!outcome.ok) {
    /* 끊긴 전송이 반쪽짜리 오브젝트를 남길 수 있다. 경로를 아는 지금 지운다. */
    await deleteInquiryPendingFile(path)

    return outcome.aborted
      ? { ok: false, aborted: true }
      : { ok: false, aborted: false, message: UPLOAD_FAILURE_MESSAGE }
  }

  return {
    ok: true,
    upload: { path, name: file.name, size: file.size, mimeType: file.type },
  }
}

/**
 * 업로드를 시작하고 **즉시** 손잡이를 돌려준다.
 *
 * 화면은 파일을 고른 순간 행을 그려야 한다(이름·크기·진행률). 업로드가 끝날 때까지
 * 기다렸다가 그리면 가장 오래 걸리는 구간이 통째로 빈 화면이 된다.
 */
export function uploadInquiryFile(
  file: File,
  onProgress: (ratio: number) => void,
): InquiryUploadHandle {
  const state: AbortState = { xhr: null, isAborted: false }

  return {
    result: run(file, onProgress, state),
    abort() {
      state.isAborted = true
      state.xhr?.abort()
    },
  }
}

/**
 * 접수 전 첨부 삭제(업로드 취소 · 목록에서 빼기).
 *
 * 권한은 기존 정책 `inquiry_attachments_delete_own`(20260908001900)이 연다 —
 * 자기 폴더(`<uid>/` 접두사) 안이면 지울 수 있고 pending 은 그 안쪽이다.
 * 실패는 삼킨다. 사용자가 할 수 있는 일이 없고, 남은 파일은 야간 배치가 걷는다
 * (`stale_inquiry_pending_attachments()`).
 */
export async function deleteInquiryPendingFile(path: string): Promise<void> {
  try {
    await createClient().storage.from(STORAGE_BUCKETS.inquiryAttachments).remove([path])
  } catch {
    /* 정리 실패는 접수를 막을 이유가 아니다. */
  }
}
