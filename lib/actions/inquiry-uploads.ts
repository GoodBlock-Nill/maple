import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildUserScopedPath,
  inquiryPendingFolder,
  isInquiryPendingPath,
  isUserScopedPath,
  STORAGE_BUCKETS,
} from '@/lib/supabase/storage'
import {
  INQUIRY_UPLOAD_FIELD,
  parsePendingInquiryUploads,
  toUploadCandidates,
  validateInquiryAttachments,
} from '@/lib/validation/inquiry-upload'

import type { TypedSupabaseClient } from '@/lib/supabase/types'
import type { PendingInquiryUpload, SizedAttachment } from '@/lib/validation/inquiry-upload'
import type { InquiryAttachment } from '@/types/domain'

/**
 * 브라우저가 직접 올린 첨부를 문의 첨부로 **확정**한다.
 *
 * 2026-09-14 부터 이미지·PDF·영상이 전부 이 길을 탄다(예전에는 영상만이었다).
 * 폼이 실어 보내는 것은 오브젝트 경로뿐이고, 그 경로는 사용자가 정하는 값이다.
 * 그래서 여기서 네 가지를 다시 본다.
 *
 *   1) 경로가 **이 사용자의** `<uid>/pending/…` 인가 (남의 첨부를 끌어오는 길 차단)
 *   2) 그 오브젝트가 실제로 있는가 — 크기·형식은 폼이 신고한 값이 아니라
 *      **스토리지가 아는 값**을 쓴다
 *   3) 그 실제 값으로 개수·합계 규칙(5개 · 200MB)을 다시 잰다
 *   4) 통과한 것만 접수된 첨부의 자리(`<uid>/<uuid>-<파일명>`)로 옮긴다
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

export const UPLOAD_CLAIM_FAILURE_MESSAGE =
  '첨부파일을 확인하지 못했습니다. 파일을 지우고 다시 올려 주세요.'

export const UPLOAD_STORAGE_UNAVAILABLE_MESSAGE =
  '첨부파일을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.'

export const UPLOAD_FORM_INVALID_MESSAGE = '첨부 정보가 올바르지 않습니다. 다시 시도해 주세요.'

export type UploadClaimResult =
  { ok: true; attachments: InquiryAttachment[] } | { ok: false; message: string }

/**
 * 서비스 롤 클라이언트. 키가 없는 환경에서는 `null` 을 돌려준다.
 *
 * 던지게 두면 첨부를 붙이지 **않은** 문의까지 500 으로 죽는다. 호출자는 첨부가
 * 실제로 있을 때만 이 함수를 부르므로, 키가 없는 환경의 영향은 "첨부 접수 불가"에
 * 머문다.
 */
export function createUploadStorageClient(): TypedSupabaseClient | null {
  try {
    return createAdminClient()
  } catch {
    return null
  }
}

/**
 * 폼의 숨은 필드에서 첨부 목록을 읽는다.
 *
 * `null` 은 "모양이 어긋남"이다 — 빈 목록과 구분해야 한다. 조용히 빈 목록으로
 * 삼키면 사용자가 올린 파일이 이유 없이 빠진 문의가 접수된다.
 */
export function readPendingUploads(formData: FormData): readonly PendingInquiryUpload[] | null {
  const raw = formData.get(INQUIRY_UPLOAD_FIELD)

  return parsePendingInquiryUploads(typeof raw === 'string' ? raw : '')
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

/**
 * 폼이 보낸 목록을 **스토리지가 아는 값**으로 바꿔 단다.
 *
 * 하나라도 없거나 경로가 이 사용자의 pending 이 아니면 통째로 실패로 끝낸다 —
 * 일부만 붙은 접수는 사용자도 운영자도 이유를 알 수 없다.
 */
function resolveUploads(
  uploads: readonly PendingInquiryUpload[],
  stored: Map<string, StoredObject>,
  userId: string,
): readonly PendingInquiryUpload[] | null {
  const resolved: PendingInquiryUpload[] = []

  for (const upload of uploads) {
    if (!isInquiryPendingPath(upload.path, userId)) {
      return null
    }

    const object = stored.get(objectName(upload.path))

    if (object === undefined) {
      return null
    }

    /* 크기·형식은 폼이 신고한 값이 아니라 스토리지가 아는 값으로 갈아 끼운다.
       신고 값을 믿으면 200MB 제한이 "200이라고 적어 보내면 통과하는" 규칙이 된다. */
    resolved.push({ ...upload, size: object.size, mimeType: object.mimeType })
  }

  return resolved
}

export async function claimPendingUploads(
  storage: TypedSupabaseClient,
  userId: string,
  uploads: readonly PendingInquiryUpload[],
  /** 수정 화면에서 그대로 두는 기존 첨부. 개수·합계를 함께 센다. */
  kept: readonly SizedAttachment[] = [],
): Promise<UploadClaimResult> {
  if (uploads.length === 0) {
    return { ok: true, attachments: [] }
  }

  /* 경로 검사가 먼저다 — 남의 uid 로 시작하는 경로는 스토리지를 한 번도 건드리지
     않고 끝나야 한다(서비스 롤이라 RLS 가 이 읽기를 막지 않는다). */
  for (const upload of uploads) {
    if (!isInquiryPendingPath(upload.path, userId)) {
      return { ok: false, message: UPLOAD_CLAIM_FAILURE_MESSAGE }
    }
  }

  const stored = await readPendingObjects(storage, userId)

  if (stored === null) {
    return { ok: false, message: UPLOAD_CLAIM_FAILURE_MESSAGE }
  }

  const resolved = resolveUploads(uploads, stored, userId)

  if (resolved === null) {
    return { ok: false, message: UPLOAD_CLAIM_FAILURE_MESSAGE }
  }

  /* 실제 크기·형식으로 폼과 **같은 규칙**을 한 번 더 잰다. 여기서 걸러야 DB CHECK 의
     23514 대신 사람이 읽는 문구가 화면으로 돌아간다. */
  const check = validateInquiryAttachments(kept, toUploadCandidates(resolved))

  if (!check.ok) {
    return { ok: false, message: check.message }
  }

  return moveClaimed(storage, userId, resolved)
}

/** 확정된 오브젝트를 접수된 첨부의 자리로 옮긴다. 중간에 실패하면 옮긴 것만 되돌린다. */
async function moveClaimed(
  storage: TypedSupabaseClient,
  userId: string,
  uploads: readonly PendingInquiryUpload[],
): Promise<UploadClaimResult> {
  const attachments: InquiryAttachment[] = []

  for (const upload of uploads) {
    const destination = buildUserScopedPath(userId, `${crypto.randomUUID()}-${upload.name}`)

    /* 정책과 같은 판정을 코드에서도 한 번 건다 — 옮기는 주체가 RLS 를 우회하므로
       여기가 "남의 폴더에 쓰지 않는다"를 지키는 유일한 지점이다. */
    const hasFailed = !isUserScopedPath(destination, userId)
      ? true
      : (await storage.storage.from(BUCKET).move(upload.path, destination)).error !== null

    if (hasFailed) {
      /* 이미 옮긴 것만 되돌린다(지운다). 아직 pending 에 있는 것은 그대로 둔다 —
         사용자가 곧바로 다시 제출하면 그 파일이 필요하고, 끝내 버려지면
         `stale_inquiry_pending_attachments()` 를 태우는 야간 배치가 걷는다. */
      await removeAttachmentPaths(
        storage,
        attachments.map((item) => item.path),
      )

      return { ok: false, message: UPLOAD_CLAIM_FAILURE_MESSAGE }
    }

    attachments.push({
      name: upload.name,
      path: destination,
      size: upload.size,
      mimeType: upload.mimeType,
    })
  }

  return { ok: true, attachments }
}

export type UploadClaim = {
  attachments: readonly InquiryAttachment[]
  /** 행 저장이 실패했을 때 확정된 첨부를 지운다. 첨부가 없으면 아무 일도 하지 않는다. */
  rollback: () => Promise<void>
}

export type FormUploadResult = { ok: true; claim: UploadClaim } | { ok: false; message: string }

const EMPTY_CLAIM: UploadClaim = { attachments: [], rollback: async () => undefined }

/**
 * 접수·수정·답장 액션이 부르는 한 단계.
 *
 * 서비스 롤 클라이언트는 **첨부가 실제로 있을 때만** 만든다. 키가 없는 환경에서도
 * 첨부 없는 문의는 평소대로 접수돼야 한다.
 */
export async function claimFormUploads(
  userId: string,
  uploads: readonly PendingInquiryUpload[],
  kept: readonly SizedAttachment[] = [],
): Promise<FormUploadResult> {
  if (uploads.length === 0) {
    return { ok: true, claim: EMPTY_CLAIM }
  }

  const storage = createUploadStorageClient()

  if (storage === null) {
    return { ok: false, message: UPLOAD_STORAGE_UNAVAILABLE_MESSAGE }
  }

  const claimed = await claimPendingUploads(storage, userId, uploads, kept)

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
 * 접수에 실패했을 때 확정된 첨부를 지운다.
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
