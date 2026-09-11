import { z } from 'zod'

import {
  INQUIRY_ATTACHMENT_MAX_TOTAL,
  INQUIRY_VIDEO_MAX_BYTES,
  INQUIRY_VIDEO_MAX_COUNT,
  INQUIRY_VIDEO_MAX_MB,
} from '@/lib/supabase/storage'

/**
 * 1:1 문의 **영상** 첨부의 규칙.
 *
 * 이미지·PDF(`inquiry.ts`)와 파일을 나눈 이유는 지나가는 길이 다르기 때문이다.
 * 이미지는 폼과 함께 서버 액션 본문으로 가고(그래서 합계 12MB 라는 상한이 있다),
 * 영상은 브라우저가 버킷에 직접 올린 뒤 **경로만** 폼에 실린다. 규칙을 한 파일에
 * 섞어 두면 "합계 상한이 영상에도 걸리는가"가 매번 헷갈린다.
 *
 * 여기 있는 판정은 전부 클라이언트와 서버가 **같이** 쓴다. 클라이언트 쪽은 안내이고
 * 신뢰 경계는 서버다 — 영상 경로는 사용자가 정하는 값이라 서버가 다시 본다.
 */

/**
 * 버킷의 `allowed_mime_types`(마이그레이션 20260910000600)와 1:1 로 맞춘 목록.
 *
 * 확장자는 MIME 에서 뽑는다. 사용자가 보낸 파일명은 내용과 다를 수 있고, 확장자가
 * 틀리면 스토리지가 content-type 을 잘못 추론해 영상이 재생 대신 내려받기로 떨어진다.
 */
export const INQUIRY_VIDEO_MIME_EXTENSIONS = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-m4v': 'm4v',
} as const

export type InquiryVideoMime = keyof typeof INQUIRY_VIDEO_MIME_EXTENSIONS

export const INQUIRY_VIDEO_MIME_TYPES: readonly string[] = Object.keys(
  INQUIRY_VIDEO_MIME_EXTENSIONS,
)

/** 파일 선택 대화상자용. MIME 만 주면 확장자로만 판단하는 환경이 파일을 잠근다. */
export const INQUIRY_VIDEO_EXTENSIONS: readonly string[] = Object.values(
  INQUIRY_VIDEO_MIME_EXTENSIONS,
).map((extension) => `.${extension}`)

export function isInquiryVideoMime(value: string): value is InquiryVideoMime {
  return Object.hasOwn(INQUIRY_VIDEO_MIME_EXTENSIONS, value)
}

/** 폼이 "이미 올라간 영상"의 목록을 실어 보내는 숨은 필드 이름. */
export const INQUIRY_VIDEO_FIELD = 'videoAttachments'

/** MIME 만 보고 영상인지 판단한다. 화면(상세·관리자)이 재생기를 세울 근거다. */
export function isVideoAttachment(mimeType: string): boolean {
  return mimeType.startsWith('video/')
}

export type InquiryVideoCheck = { ok: true } | { ok: false; message: string }

/** File 없이도 검사할 수 있도록 필요한 부분만 본다. */
export type VideoCandidate = { name: string; type: string; size: number }

export type VideoCountContext = {
  /** 이미 올라갔거나(기존 첨부 포함) 올라가는 중인 영상 수. */
  videoCount: number
  /** 영상이 아닌 첨부 수(기존에 남기는 것 + 지금 고른 이미지·PDF). */
  otherCount: number
}

/**
 * 영상 한 건의 검사.
 *
 * 순서가 곧 사용자가 보는 문구의 우선순위다 — 형식이 틀렸으면 크기 얘기를 해 봐야
 * 소용이 없고, 개수가 이미 찼으면 무엇을 골라도 안 되므로 그것부터 알린다.
 */
export function validateInquiryVideo(
  file: VideoCandidate,
  { videoCount, otherCount }: VideoCountContext,
): InquiryVideoCheck {
  if (!isInquiryVideoMime(file.type)) {
    return { ok: false, message: 'mp4 · mov · webm · m4v 영상만 올릴 수 있습니다.' }
  }

  if (file.size <= 0) {
    return { ok: false, message: '빈 파일은 올릴 수 없습니다.' }
  }

  if (file.size > INQUIRY_VIDEO_MAX_BYTES) {
    return {
      ok: false,
      message: `${file.name} 은(는) ${INQUIRY_VIDEO_MAX_MB}MB 를 넘습니다. 영상은 각 ${INQUIRY_VIDEO_MAX_MB}MB 이하만 올릴 수 있습니다.`,
    }
  }

  if (videoCount + 1 > INQUIRY_VIDEO_MAX_COUNT) {
    return {
      ok: false,
      message: `영상은 최대 ${INQUIRY_VIDEO_MAX_COUNT}개까지 첨부할 수 있습니다.`,
    }
  }

  /* 영상 개수는 이미지·PDF 와 별도 자리를 쓰지만, 전체 합계(이미지·PDF + 영상)는
     여전히 상한이 있다 — 종류별 상한을 둘 다 지켜도 합계가 어긋나는 입력(예: 옛
     첨부가 섞인 수정 화면)을 한 번 더 막는다. */
  if (videoCount + otherCount + 1 > INQUIRY_ATTACHMENT_MAX_TOTAL) {
    return {
      ok: false,
      message: `첨부파일은 최대 ${INQUIRY_ATTACHMENT_MAX_TOTAL}개까지 첨부할 수 있습니다.`,
    }
  }

  return { ok: true }
}

/**
 * 폼이 실어 보내는 "이미 올라간 영상" 한 건.
 *
 * 여기 담긴 값은 전부 **사용자가 정한 것**이다. 경로가 정말 이 사용자의 pending
 * 오브젝트인지, 크기·형식이 신고한 대로인지는 서버가 스토리지에 다시 물어본다
 * (`lib/actions/inquiry-videos.ts`). 이 스키마는 모양만 본다.
 */
export const pendingInquiryVideoSchema = z.object({
  path: z.string().min(1).max(300),
  name: z.string().min(1).max(200),
  size: z.number().int().nonnegative(),
  mimeType: z.string().min(1).max(100),
})

export type PendingInquiryVideo = z.infer<typeof pendingInquiryVideoSchema>

export const pendingInquiryVideoListSchema = z
  .array(pendingInquiryVideoSchema)
  .max(INQUIRY_VIDEO_MAX_COUNT)

/**
 * 숨은 필드의 JSON 을 목록으로 읽는다.
 *
 * 빈 값은 "영상 없음"이다(폼은 영상을 안 붙여도 필드를 그린다). 모양이 어긋나면
 * `null` 을 돌려 호출자가 "잘못된 요청"으로 끊게 한다 — 조용히 빈 목록으로 삼키면
 * 사용자가 올린 영상이 이유 없이 빠진 문의가 접수된다.
 */
export function parsePendingInquiryVideos(raw: string): readonly PendingInquiryVideo[] | null {
  const trimmed = raw.trim()

  if (trimmed === '') {
    return []
  }

  try {
    const parsed = pendingInquiryVideoListSchema.safeParse(JSON.parse(trimmed))

    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
