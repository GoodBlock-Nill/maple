import {
  INQUIRY_ATTACHMENT_MAX_COUNT,
  INQUIRY_ATTACHMENT_TOTAL_MAX_MB,
} from '@/lib/supabase/storage'
import { INQUIRY_ATTACHMENT_MIME_EXTENSIONS } from '@/lib/validation/inquiry-upload'
import { INQUIRY_VIDEO_MIME_TYPES } from '@/lib/validation/inquiry-video'

/**
 * 첨부 안내(시안 v2: 두 줄).
 *
 * 숫자를 문구에 박지 않고 검증 상수에서 끌어온다 — 안내와 실제 제한이 갈리면
 * 사용자는 "된다고 적힌 파일"을 고르고 오류를 본다.
 *
 * 2026-09-14 오너 지시로 형식별 구분이 사라졌다(이미지·PDF 3 + 영상 2 → 통합 5).
 * 그래서 첫 줄은 **하나의 규칙**만 말하고, 받을 수 있는 형식은 둘째 줄로 내린다.
 * 형식 목록도 검증 상수에서 뽑아 폼과 서버가 갈리지 않게 한다.
 */

/**
 * 형식 목록은 **확장자 맵의 값**에서 뽑는다.
 *
 * MIME 을 그대로 줄이면 `video/quicktime` 이 "QUICKTIME" 으로, `image/jpeg` 가
 * "JPEG" 로 읽힌다 — 사용자가 파일 선택 창에서 보는 이름(`.mov` · `.jpg`)과 달라
 * "내 파일이 이 목록에 있나"를 한 번 더 생각하게 된다. 맵의 값은 이미 그 이름이다.
 */
function toFormatLabel(extension: string): string {
  return extension.toUpperCase()
}

const VIDEO_MIME_SET = new Set(INQUIRY_VIDEO_MIME_TYPES)

const FORMAT_ENTRIES = Object.entries(INQUIRY_ATTACHMENT_MIME_EXTENSIONS)

/* 영상만 뒤로 뺀다 — "사진·문서 / 영상" 순으로 읽혀야 사용자가 자기 파일을 빨리 찾는다. */
const FILE_FORMATS = FORMAT_ENTRIES.filter(([mime]) => !VIDEO_MIME_SET.has(mime))
  .map(([, extension]) => toFormatLabel(extension))
  .join(', ')

const VIDEO_FORMATS = FORMAT_ENTRIES.filter(([mime]) => VIDEO_MIME_SET.has(mime))
  .map(([, extension]) => toFormatLabel(extension))
  .join(', ')

export const ATTACHMENT_NOTICE_LINES: readonly string[] = [
  `이미지·PDF·영상 형식에 관계없이 최대 ${INQUIRY_ATTACHMENT_MAX_COUNT}개 · 총 ${INQUIRY_ATTACHMENT_TOTAL_MAX_MB}MB`,
  `(${FILE_FORMATS} · ${VIDEO_FORMATS})`,
]

export const INQUIRY_FILE_PICK_LABEL = '파일 선택'
