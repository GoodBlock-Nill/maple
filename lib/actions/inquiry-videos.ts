import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildUserScopedPath,
  inquiryPendingFolder,
  INQUIRY_VIDEO_MAX_BYTES,
  isInquiryPendingPath,
  isUserScopedPath,
  STORAGE_BUCKETS,
} from '@/lib/supabase/storage'
import {
  INQUIRY_VIDEO_FIELD,
  isInquiryVideoMime,
  parsePendingInquiryVideos,
} from '@/lib/validation/inquiry-video'

import type { TypedSupabaseClient } from '@/lib/supabase/types'
import type { PendingInquiryVideo } from '@/lib/validation/inquiry-video'
import type { InquiryAttachment } from '@/types/domain'

/**
 * 브라우저가 직접 올린 영상을 문의 첨부로 **확정**한다.
 *
 * 폼이 실어 보내는 것은 오브젝트 경로뿐이고, 그 경로는 사용자가 정하는 값이다.
 * 그래서 여기서 세 가지를 다시 본다.
 *
 *   1) 경로가 **이 사용자의** `<uid>/pending/…` 인가 (남의 첨부를 끌어오는 길 차단)
 *   2) 그 오브젝트가 실제로 있는가, 크기·형식이 규칙 안인가
 *      — 폼이 신고한 숫자가 아니라 **스토리지가 아는 값**을 쓴다
 *   3) 확정된 것만 접수된 첨부의 자리(`<uid>/<uuid>-<파일명>`)로 옮긴다
 *
 * 옮기는 주체가 서비스 롤인 이유: `move` 는 storage.objects 의 UPDATE 인데
 * `inquiry-attachments` 에는 사용자용 UPDATE 정책이 없다(관리자 전용
 * `inquiry_attachments_admin_write` 뿐이다). 그래서 RLS 가 이 이동을 막아 주지
 * 못한다 — (1)의 검사가 서비스 롤이 만들 수 있는 경로를 사용자 본인의 pending
 * 오브젝트로 못 박는 **유일한** 경계다.
 *
 * `'use server'` 파일이 아니다 — 서버 액션 파일은 export 가 전부 액션이어야 한다.
 */

const BUCKET = STORAGE_BUCKETS.inquiryAttachments

/** 목록 한 번으로 pending 폴더 전체를 훑는다. 사용자당 몇 건 수준이라 이걸로 충분하다. */
const PENDING_LIST_LIMIT = 100

export const VIDEO_CLAIM_FAILURE_MESSAGE =
  '영상 첨부를 확인하지 못했습니다. 영상을 지우고 다시 올려 주세요.'

export const VIDEO_STORAGE_UNAVAILABLE_MESSAGE =
  '영상 첨부를 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.'

export const VIDEO_FORM_INVALID_MESSAGE = '영상 첨부 정보가 올바르지 않습니다. 다시 시도해 주세요.'

export type VideoClaimResult =
  { ok: true; attachments: InquiryAttachment[] } | { ok: false; message: string }

/**
 * 서비스 롤 클라이언트. 키가 없는 환경에서는 `null` 을 돌려준다.
 *
 * 던지게 두면 영상을 붙이지 **않은** 문의까지 500 으로 죽는다. 호출자는 영상이
 * 실제로 있을 때만 이 함수를 부르므로, 키가 없는 환경의 영향은 "영상 접수 불가"에
 * 머문다.
 */
export function createVideoStorageClient(): TypedSupabaseClient | null {
  try {
    return createAdminClient()
  } catch {
    return null
  }
}

/**
 * 폼의 숨은 필드에서 영상 목록을 읽는다.
 *
 * `null` 은 "모양이 어긋남"이다 — 빈 목록과 구분해야 한다. 조용히 빈 목록으로
 * 삼키면 사용자가 올린 영상이 이유 없이 빠진 문의가 접수된다.
 */
export function readPendingVideos(formData: FormData): readonly PendingInquiryVideo[] | null {
  const raw = formData.get(INQUIRY_VIDEO_FIELD)

  return parsePendingInquiryVideos(typeof raw === 'string' ? raw : '')
}

type StoredObject = { size: number; mimeType: string }

/** pending 폴더의 실제 오브젝트 — 이름 → 스토리지가 아는 크기·형식. */
async function readPendingObjects(
  storage: TypedSupabaseClient,
  userId: string,
): Promise<Map<string, StoredObject> | null> {
  const { data, error } = await storage.storage
    .from(BUCKET)
    .list(inquiryPendingFolder(userId), { limit: PENDING_LIST_LIMIT })

  if (error !== null || data === null) {
    return null
  }

  const objects = new Map<string, StoredObject>()

  for (const item of data) {
    const metadata = (item.metadata ?? {}) as Record<string, unknown>

    objects.set(item.name, {
      size: typeof metadata.size === 'number' ? metadata.size : 0,
      mimeType: typeof metadata.mimetype === 'string' ? metadata.mimetype : '',
    })
  }

  return objects
}

/** `<uid>/pending/<파일명>` 의 마지막 세그먼트. `list()` 결과의 키와 맞춘다. */
function objectName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

export async function claimPendingVideos(
  storage: TypedSupabaseClient,
  userId: string,
  videos: readonly PendingInquiryVideo[],
): Promise<VideoClaimResult> {
  if (videos.length === 0) {
    return { ok: true, attachments: [] }
  }

  for (const video of videos) {
    if (!isInquiryPendingPath(video.path, userId)) {
      return { ok: false, message: VIDEO_CLAIM_FAILURE_MESSAGE }
    }
  }

  const stored = await readPendingObjects(storage, userId)

  if (stored === null) {
    return { ok: false, message: VIDEO_CLAIM_FAILURE_MESSAGE }
  }

  const attachments: InquiryAttachment[] = []

  for (const video of videos) {
    const object = stored.get(objectName(video.path))

    /* 크기·형식은 폼이 신고한 값이 아니라 스토리지가 아는 값을 쓴다. 신고 값을
       믿으면 100MB 제한이 "100 이라고 적어 보내면 통과하는" 규칙이 된다. */
    if (
      object === undefined ||
      !isInquiryVideoMime(object.mimeType) ||
      object.size <= 0 ||
      object.size > INQUIRY_VIDEO_MAX_BYTES
    ) {
      await removeAttachmentPaths(
        storage,
        attachments.map((item) => item.path),
      )

      return { ok: false, message: VIDEO_CLAIM_FAILURE_MESSAGE }
    }

    const destination = buildUserScopedPath(userId, `${crypto.randomUUID()}-${video.name}`)

    /* 정책과 같은 판정을 코드에서도 한 번 건다 — 옮기는 주체가 RLS 를 우회하므로
       여기가 "남의 폴더에 쓰지 않는다"를 지키는 유일한 지점이다. */
    if (!isUserScopedPath(destination, userId)) {
      await removeAttachmentPaths(
        storage,
        attachments.map((item) => item.path),
      )

      return { ok: false, message: VIDEO_CLAIM_FAILURE_MESSAGE }
    }

    const { error } = await storage.storage.from(BUCKET).move(video.path, destination)

    if (error !== null) {
      /* 이미 옮긴 것만 되돌린다(지운다). 아직 pending 에 있는 것은 그대로 둔다 —
         사용자가 곧바로 다시 제출하면 그 파일이 필요하고, 끝내 버려지면
         `stale_inquiry_pending_attachments()` 를 태우는 야간 배치가 걷는다. */
      await removeAttachmentPaths(
        storage,
        attachments.map((item) => item.path),
      )

      return { ok: false, message: VIDEO_CLAIM_FAILURE_MESSAGE }
    }

    attachments.push({
      name: video.name,
      path: destination,
      size: object.size,
      mimeType: object.mimeType,
    })
  }

  return { ok: true, attachments }
}

export type VideoClaim = {
  attachments: readonly InquiryAttachment[]
  /** 행 저장이 실패했을 때 확정된 영상을 지운다. 영상이 없으면 아무 일도 하지 않는다. */
  rollback: () => Promise<void>
}

export type FormVideoResult = { ok: true; claim: VideoClaim } | { ok: false; message: string }

const EMPTY_CLAIM: VideoClaim = { attachments: [], rollback: async () => undefined }

/**
 * 접수·수정 액션이 부르는 한 단계.
 *
 * 서비스 롤 클라이언트는 **영상이 실제로 있을 때만** 만든다. 키가 없는 환경에서도
 * 영상 없는 문의는 평소대로 접수돼야 한다.
 */
export async function claimFormVideos(
  userId: string,
  videos: readonly PendingInquiryVideo[],
): Promise<FormVideoResult> {
  if (videos.length === 0) {
    return { ok: true, claim: EMPTY_CLAIM }
  }

  const storage = createVideoStorageClient()

  if (storage === null) {
    return { ok: false, message: VIDEO_STORAGE_UNAVAILABLE_MESSAGE }
  }

  const claimed = await claimPendingVideos(storage, userId, videos)

  if (!claimed.ok) {
    return { ok: false, message: claimed.message }
  }

  return {
    ok: true,
    claim: {
      attachments: claimed.attachments,
      rollback: () =>
        removeAttachmentPaths(
          storage,
          claimed.attachments.map((attachment) => attachment.path),
        ),
    },
  }
}

/**
 * 접수에 실패했을 때 확정된 영상을 지운다.
 *
 * 사용자 세션으로는 지울 수 없는 자리(`<uid>/<파일명>`)라 여기서도 서비스 롤을 쓴다.
 * 실패는 삼킨다 — 접수 실패 안내를 덮을 이유가 없다.
 */
export async function removeAttachmentPaths(
  storage: TypedSupabaseClient,
  paths: readonly string[],
): Promise<void> {
  if (paths.length === 0) {
    return
  }

  await storage.storage.from(BUCKET).remove([...paths])
}
