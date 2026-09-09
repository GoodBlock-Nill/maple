/**
 * 문의 출처(웹 폼 · 이메일)와 표시 문구.
 *
 * 의존성이 없는 파일로 따로 둔다 — `inquiries.ts` 안에 넣으면 300줄을 넘고,
 * 목록 필터·데이터 계층·화면이 모두 여기만 보면 되도록 한곳에 모은다.
 * (설계 근거: docs/admin/EMAIL-INQUIRY-PLAN.md §4 · §7)
 */

export const INQUIRY_SOURCES = ['web', 'email'] as const

export type InquirySource = (typeof INQUIRY_SOURCES)[number]

export const INQUIRY_SOURCE_LABELS: Record<InquirySource, string> = {
  web: '웹',
  email: '이메일',
}

export function isInquirySource(value: string | null | undefined): value is InquirySource {
  return typeof value === 'string' && (INQUIRY_SOURCES as readonly string[]).includes(value)
}

/**
 * DB 값을 화면 값으로 좁힌다. 열이 `text` 라 제약 밖의 값이 들어올 여지가 있고,
 * 그때 화면이 비는 것보다 '웹'으로 보이는 편이 안전하다(운영자가 목록에서 놓치지 않는다).
 */
export function toInquirySource(value: string | null | undefined): InquirySource {
  return isInquirySource(value) ? value : 'web'
}

/* 이메일 문의는 사용자 폼(카테고리 select)을 거치지 않으므로 수신 함수가
   `category='email'`, `type='general'` 로 고정해 넣는다. 운영자 화면에 영문 값이
   그대로 나오지 않도록 표시 계층에서만 한국어로 바꾼다. */
const INQUIRY_CATEGORY_LABELS: Record<string, string> = { email: '이메일' }
const INQUIRY_TYPE_LABELS: Record<string, string> = { general: '일반' }

export function inquiryCategoryLabel(value: string): string {
  return INQUIRY_CATEGORY_LABELS[value] ?? value
}

export function inquiryTypeLabel(value: string): string {
  return INQUIRY_TYPE_LABELS[value] ?? value
}
