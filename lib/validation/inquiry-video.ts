/**
 * 영상 **형식** 판정.
 *
 * 2026-09-14 부터 첨부 규칙(개수·용량)은 형식을 가리지 않는다 — 그 규칙은
 * `lib/validation/inquiry-upload.ts` 한곳에 있다. 여기 남은 것은 "이 MIME 이
 * 영상인가"뿐이다. 그 물음은 규칙이 아니라 **화면**이 쓴다: 상세·관리자는 영상에
 * 링크가 아니라 재생기를 세워야 하고, 업로드 경로는 MIME 에서 확장자를 뽑아야 한다.
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

/** MIME 만 보고 영상인지 판단한다. 화면(상세·관리자)이 재생기를 세울 근거다. */
export function isVideoAttachment(mimeType: string): boolean {
  return mimeType.startsWith('video/')
}
