import {
  INQUIRY_ATTACHMENT_MAX_MB,
  INQUIRY_ATTACHMENT_TOTAL_MAX_MB,
  INQUIRY_FILE_MAX_COUNT,
  INQUIRY_VIDEO_MAX_COUNT,
  INQUIRY_VIDEO_MAX_MB,
} from '@/lib/supabase/storage'
import { INQUIRY_ATTACHMENT_MIME_TYPES } from '@/lib/validation/inquiry'
import { INQUIRY_VIDEO_EXTENSIONS } from '@/lib/validation/inquiry-video'

/**
 * 첨부 안내(시안 v2: 두 줄).
 *
 * 숫자를 문구에 박지 않고 검증 상수에서 끌어온다 — 안내와 실제 제한이 갈리면
 * 사용자는 "된다고 적힌 파일"을 고르고 오류를 본다. 이미지·PDF 와 영상은 각자
 * 자리를 쓰므로(2026-09-11 오너 지시) 한 줄에 나란히 적고, 받을 수 있는 형식은
 * 둘째 줄로 내린다(형식 목록도 검증 상수에서 뽑아 폼과 서버가 갈리지 않게 한다).
 */
const VIDEO_TOTAL_MAX_MB = INQUIRY_VIDEO_MAX_MB * INQUIRY_VIDEO_MAX_COUNT

/**
 * `image/png` · `.mp4` 처럼 서로 다른 표기를 화면용 대문자 확장자로 통일한다.
 *
 * `image/jpeg` 만 예외를 둔다 — 파일 선택 창에 보이는 이름은 `.jpg` 라, MIME 을
 * 그대로 올리면 사용자가 자기 사진이 되는 형식인지 한 번 더 생각하게 된다.
 */
const EXTENSION_LABEL_OVERRIDES: Record<string, string> = { 'image/jpeg': 'JPG' }

function toExtensionLabel(value: string): string {
  return EXTENSION_LABEL_OVERRIDES[value] ?? value.replace(/^.*[/.]/u, '').toUpperCase()
}

const ATTACHMENT_FILE_FORMATS = INQUIRY_ATTACHMENT_MIME_TYPES.map(toExtensionLabel).join(', ')

const ATTACHMENT_VIDEO_FORMATS = INQUIRY_VIDEO_EXTENSIONS.map(toExtensionLabel).join(', ')

export const ATTACHMENT_NOTICE_LINES: readonly string[] = [
  `이미지·PDF ${INQUIRY_ATTACHMENT_MAX_MB}MB/개 · 최대 ${INQUIRY_FILE_MAX_COUNT}개 · ` +
    `총 ${INQUIRY_ATTACHMENT_TOTAL_MAX_MB}MB / 영상 ${INQUIRY_VIDEO_MAX_MB}MB/개 · ` +
    `최대 ${INQUIRY_VIDEO_MAX_COUNT}개 · 총 ${VIDEO_TOTAL_MAX_MB}MB`,
  `(${ATTACHMENT_FILE_FORMATS} · ${ATTACHMENT_VIDEO_FORMATS})`,
]

export const INQUIRY_FILE_PICK_LABEL = '파일 선택'
