import { z } from 'zod'

import {
  INQUIRY_ATTACHMENT_FILE_MAX_BYTES,
  INQUIRY_ATTACHMENT_FILE_MAX_MB,
  INQUIRY_ATTACHMENT_MAX_COUNT,
  INQUIRY_ATTACHMENT_TOTAL_MAX_BYTES,
  INQUIRY_ATTACHMENT_TOTAL_MAX_MB,
} from '@/lib/supabase/storage'
import { INQUIRY_VIDEO_MIME_EXTENSIONS } from '@/lib/validation/inquiry-video'

/**
 * 1:1 문의 첨부의 규칙 — 접수 · 수정 · 회원 답장이 **모두 같은 것**을 쓴다.
 *
 * 2026-09-14 오너 지시로 형식별 구분이 사라졌다. 이미지·PDF·영상 가릴 것 없이
 * 총 5개 · 합계 200MB 다. 그래서 규칙도 파일을 나누지 않고 여기 하나로 모은다 —
 * 갈라 두면 "이 파일은 어느 표를 보나"가 매번 헷갈린다.
 *
 * 형식이 통일된 이유는 지나가는 길이 하나가 됐기 때문이다. 예전에는 이미지만 서버
 * 액션 본문(multipart)으로 갔고 그 본문 상한이 곧 이미지 상한이었다. 지금은 모든
 * 첨부가 브라우저 → 버킷으로 직접 올라가고(`lib/supabase/upload-inquiry-file.ts`)
 * 폼에는 경로만 실린다. 남은 천장은 버킷의 `file_size_limit`(200MiB) 하나다.
 *
 * 여기 있는 판정은 클라이언트와 서버가 **같이** 쓴다. 클라이언트 쪽은 안내이고
 * 신뢰 경계는 서버다 — 경로도 크기도 사용자가 정하는 값이라 서버가 스토리지에
 * 다시 물어본 값으로 이 함수를 한 번 더 돌린다.
 */

/**
 * 웹 폼이 받는 형식 ↔ 확장자.
 *
 * 버킷(마이그레이션 20260909000300 · 20260910000600)은 zip · txt 까지 열려 있지만
 * 그쪽은 **이메일로 들어오는 첨부**를 담기 위한 것이라 여기서는 일부러 좁게 둔다.
 * 확장자를 함께 갖는 이유는 업로드 경로(`<uid>/pending/<uuid>.<ext>`)가 MIME 에서
 * 확장자를 뽑기 때문이다 — 사용자가 보낸 파일명은 내용과 다를 수 있고, 확장자가
 * 틀리면 스토리지가 content-type 을 잘못 추론해 사진이 내려받기로 떨어진다.
 */
export const INQUIRY_ATTACHMENT_MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  ...INQUIRY_VIDEO_MIME_EXTENSIONS,
} as const

export type InquiryAttachmentMime = keyof typeof INQUIRY_ATTACHMENT_MIME_EXTENSIONS

export const INQUIRY_ATTACHMENT_MIME_TYPES: readonly string[] = Object.keys(
  INQUIRY_ATTACHMENT_MIME_EXTENSIONS,
)

export const INQUIRY_ATTACHMENT_EXTENSIONS: readonly string[] = Object.values(
  INQUIRY_ATTACHMENT_MIME_EXTENSIONS,
).map((extension) => `.${extension}`)

export function isInquiryAttachmentMime(value: string): value is InquiryAttachmentMime {
  return Object.hasOwn(INQUIRY_ATTACHMENT_MIME_EXTENSIONS, value)
}

/**
 * 파일 선택 대화상자에 넘길 `accept`.
 *
 * 확장자만 주면 일부 모바일 브라우저가 사진을 잠그고, MIME 만 주면 확장자로만
 * 판단하는 환경이 파일을 잠근다 — 그래서 둘 다 적는다.
 */
export const INQUIRY_ATTACHMENT_ACCEPT = [
  ...INQUIRY_ATTACHMENT_MIME_TYPES,
  /* 사파리·일부 안드로이드가 jpg 를 확장자로만 판단한다. `.jpeg` 는 맵에 없어 따로 적는다. */
  '.jpeg',
  ...INQUIRY_ATTACHMENT_EXTENSIONS,
].join(',')

/** 폼이 "이미 올라간 첨부"의 목록을 실어 보내는 숨은 필드 이름. */
export const INQUIRY_UPLOAD_FIELD = 'pendingAttachments'

export type InquiryAttachmentCheck = { ok: true } | { ok: false; message: string }

/** 파일 객체의 필요한 부분만 본다(File 없이도 단위 테스트할 수 있게). */
export type UploadCandidate = { name: string; type: string; size: number }

/** 이미 자리를 차지한 첨부(수정 화면에서 남기는 것 · 올라간 것). 크기만 쓴다. */
export type SizedAttachment = { size: number }

const UNSUPPORTED_MESSAGE =
  '이미지(JPG, PNG, GIF, WEBP) · PDF · 영상(MP4, MOV, WEBM, M4V) 파일만 올릴 수 있습니다.'

export const INQUIRY_ATTACHMENT_COUNT_MESSAGE = `첨부파일은 최대 ${INQUIRY_ATTACHMENT_MAX_COUNT}개까지 올릴 수 있습니다.`

export const INQUIRY_ATTACHMENT_TOTAL_MESSAGE = `첨부파일은 합쳐서 ${INQUIRY_ATTACHMENT_TOTAL_MAX_MB}MB 이하만 올릴 수 있습니다.`

function totalBytes(files: readonly SizedAttachment[]): number {
  return files.reduce((sum, file) => sum + file.size, 0)
}

/**
 * 첨부 검증 — 개수 · 형식 · 용량.
 *
 * 버킷에도 같은 제한이 있지만 거기서 걸리면 사용자는 영문 스토리지 오류만 본다.
 * 같은 규칙을 앞단에서 재서 한국어 안내를 돌려준다.
 *
 * 순서가 곧 문구의 우선순위다 — 개수가 이미 찼으면 무엇을 골라도 안 되므로 그것부터
 * 알리고, 형식이 틀렸으면 크기 얘기는 소용이 없다.
 *
 * `kept` 는 **이미 자리를 차지한 첨부**다(수정 화면에서 그대로 두는 기존 첨부 ·
 * 이미 올라간 것). 개수도 합계도 이쪽을 함께 세야 한다 — 새 파일만 재면 "기존 3개 +
 * 새 3개" 가 폼에서는 통과하고 DB CHECK 에서 23514 로 터진다.
 */
export function validateInquiryAttachments(
  kept: readonly SizedAttachment[],
  pending: readonly UploadCandidate[],
): InquiryAttachmentCheck {
  if (kept.length + pending.length > INQUIRY_ATTACHMENT_MAX_COUNT) {
    return { ok: false, message: INQUIRY_ATTACHMENT_COUNT_MESSAGE }
  }

  for (const file of pending) {
    if (!isInquiryAttachmentMime(file.type)) {
      return { ok: false, message: UNSUPPORTED_MESSAGE }
    }

    if (file.size <= 0) {
      return { ok: false, message: '빈 파일은 올릴 수 없습니다.' }
    }

    if (file.size > INQUIRY_ATTACHMENT_FILE_MAX_BYTES) {
      return {
        ok: false,
        message: `${file.name} 은(는) ${INQUIRY_ATTACHMENT_FILE_MAX_MB}MB 를 넘습니다. 첨부파일은 각 ${INQUIRY_ATTACHMENT_FILE_MAX_MB}MB 이하만 올릴 수 있습니다.`,
      }
    }
  }

  if (totalBytes(kept) + totalBytes(pending) > INQUIRY_ATTACHMENT_TOTAL_MAX_BYTES) {
    return { ok: false, message: INQUIRY_ATTACHMENT_TOTAL_MESSAGE }
  }

  return { ok: true }
}

/**
 * 폼이 실어 보내는 "이미 올라간 첨부" 한 건.
 *
 * 여기 담긴 값은 전부 **사용자가 정한 것**이다. 경로가 정말 이 사용자의 pending
 * 오브젝트인지, 크기·형식이 신고한 대로인지는 서버가 스토리지에 다시 물어본다
 * (`lib/actions/inquiry-uploads.ts`). 이 스키마는 모양만 본다.
 */
export const pendingInquiryUploadSchema = z.object({
  path: z.string().min(1).max(300),
  name: z.string().min(1).max(200),
  size: z.number().int().nonnegative(),
  mimeType: z.string().min(1).max(100),
})

export type PendingInquiryUpload = z.infer<typeof pendingInquiryUploadSchema>

export const pendingInquiryUploadListSchema = z
  .array(pendingInquiryUploadSchema)
  .max(INQUIRY_ATTACHMENT_MAX_COUNT)

/**
 * 숨은 필드의 JSON 을 목록으로 읽는다.
 *
 * 빈 값은 "첨부 없음"이다(폼은 첨부를 안 붙여도 필드를 그린다). 모양이 어긋나면
 * `null` 을 돌려 호출자가 "잘못된 요청"으로 끊게 한다 — 조용히 빈 목록으로 삼키면
 * 사용자가 올린 파일이 이유 없이 빠진 문의가 접수된다.
 */
export function parsePendingInquiryUploads(raw: string): readonly PendingInquiryUpload[] | null {
  const trimmed = raw.trim()

  if (trimmed === '') {
    return []
  }

  try {
    const parsed = pendingInquiryUploadListSchema.safeParse(JSON.parse(trimmed))

    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/**
 * 올라간 첨부를 검증이 보는 모양으로 바꾼다.
 *
 * `PendingInquiryUpload` 는 DB 에 적히는 모양(`mimeType`)이고 `UploadCandidate` 는
 * `File` 의 모양(`type`)이다. 둘을 오가는 자리가 네 곳(폼·접수·수정·답장)이라
 * 변환을 여기 한 번만 적는다.
 */
export function toUploadCandidates(
  uploads: readonly PendingInquiryUpload[],
): readonly UploadCandidate[] {
  return uploads.map((upload) => ({
    name: upload.name,
    type: upload.mimeType,
    size: upload.size,
  }))
}
