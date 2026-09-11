import { formatInquiryNo } from '@/lib/utils/inquiry-no'

/**
 * 답변 템플릿의 자리표시자 치환.
 *
 * 순수 함수만 둔다 — 관리 화면의 미리보기(클라이언트)와 문의 상세의 '템플릿 불러오기'가
 * **같은 코드**로 같은 결과를 내야 한다. 두 곳에 따로 쓰면 미리보기에서 본 문장과
 * 실제로 삽입되는 문장이 갈린다.
 *
 * 치환은 **불러오는 순간 한 번**이다. 저장되는 답변에는 자리표시자가 남지 않는다 —
 * 남겨 두면 사용자 화면에 `{{닉네임}}` 이 그대로 노출된다.
 *
 * 아는 이름만 바꾼다. 모르는 `{{...}}` 는 그대로 둔다 — 운영자가 손으로 채우려고 적어
 * 둔 표시일 수 있고, 조용히 지우면 빈칸인 채로 발송된다.
 */

export type InquiryPlaceholderSource = {
  id: string
  /** 접수번호(`inquiries.inquiry_no`). 문장에는 `#1024` 로 들어간다. */
  inquiryNo: number
  title: string
  category: string
  nickname: string
}

export type InquiryPlaceholder = {
  token: string
  /** 화면의 안내 줄에 그대로 적는다. */
  description: string
}

/** 화면(다이얼로그 · 불러오기 안내)이 그대로 나열하는 목록. 순서가 곧 표시 순서다. */
export const INQUIRY_REPLY_PLACEHOLDERS: readonly InquiryPlaceholder[] = [
  { token: '{{닉네임}}', description: '문의한 회원의 닉네임(이메일 문의는 발신자 이름)' },
  { token: '{{문의번호}}', description: '접수번호(예: #1024). 사용자 화면·메일과 같은 값' },
  { token: '{{카테고리}}', description: '문의 카테고리 이름' },
  { token: '{{제목}}', description: '문의 제목' },
] as const

/** 값이 비었을 때 대신 넣는 말. 빈칸으로 두면 "안녕하세요, 님." 같은 문장이 나간다. */
const FALLBACKS: Record<string, string> = {
  닉네임: '고객',
  문의번호: '-',
  카테고리: '문의',
  제목: '문의',
}

const PLACEHOLDER_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g

/**
 * 접수번호 — `#1024`.
 *
 * 2026-09-11 이전에는 문의 ID 앞 8자리(`ABCD1234`)를 썼다. `inquiries.inquiry_no` 가
 * 생기면서 **사용자 화면·메일·관리자 목록이 모두 같은 값**을 쓰게 됐고, 답변 문장만
 * 다른 번호를 적고 있으면 사용자가 "그 번호는 어디에 있느냐"고 되묻는다.
 */
export function inquiryNumber(inquiryNo: number): string {
  return formatInquiryNo(inquiryNo)
}

/** 문의 한 건 → 자리표시자 값 표. */
export function toPlaceholderValues(inquiry: InquiryPlaceholderSource): Record<string, string> {
  return {
    닉네임: inquiry.nickname,
    문의번호: inquiryNumber(inquiry.inquiryNo),
    카테고리: inquiry.category,
    제목: inquiry.title,
  }
}

/** 템플릿 본문 + 문의 → 답변 칸에 넣을 문장. */
export function applyReplyTemplate(body: string, inquiry: InquiryPlaceholderSource): string {
  const values = toPlaceholderValues(inquiry)

  return body.replace(PLACEHOLDER_PATTERN, (match, rawName: string) => {
    const value = values[rawName]

    if (value === undefined) {
      return match
    }

    return value.trim() === '' ? (FALLBACKS[rawName] ?? match) : value
  })
}

/**
 * 관리 화면 미리보기용 예시 문의.
 *
 * 운영자가 저장 전에 "사용자가 읽을 문장"을 확인하는 자리다. 실제 문의를 끌어오지
 * 않는 이유는 템플릿이 특정 문의에 매이지 않기 때문이다.
 */
export const SAMPLE_INQUIRY: InquiryPlaceholderSource = {
  id: 'a1b2c3d4-0000-4000-8000-000000000000',
  inquiryNo: 1024,
  title: '아이템이 사라졌어요',
  category: '재화·아이템',
  nickname: '글자용사',
}
