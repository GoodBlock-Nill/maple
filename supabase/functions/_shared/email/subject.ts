/**
 * 제목 규칙.
 *
 * 답신 제목은 `Re: <원제목> [글자월드 문의 #1024]`. 괄호 안은 `inquiries.inquiry_no` —
 * 사용자 화면·관리자 콘솔과 **같은 접수번호**다(2026-09-11, 마이그레이션 20260911000400).
 *
 * 그전에는 uuid 앞 8자(`[문의 #a1b2c3d4]`)를 썼다. 그 값은 어느 화면에도 보이지 않아
 * 사용자가 "이 번호는 어디서 확인하느냐"고 되물었다. 옛 태그는 **걷어내기만** 한다 —
 * 이미 나간 메일에 답장이 오면 제목에 그 태그가 남아 있기 때문이다.
 */

export const INQUIRY_TITLE_MAX_LENGTH = 200

export const EMPTY_SUBJECT_TITLE = '(제목 없음)'

/* 앉힐 때 이미 붙어 있는 회신 접두사는 걷어낸다 — `Re: Re: Re:` 가 쌓이는 것을 막는다. */
const REPLY_PREFIX_PATTERN = /^(?:\s*(?:re|답장|회신|aw|fwd?|fw)\s*:\s*)+/i

/** 옛 태그(`[문의 #a1b2c3d4]`)와 새 태그(`[글자월드 문의 #1024]`)를 모두 걷어낸다. */
const INQUIRY_TAG_PATTERN = /\s*\[(?:글자월드 )?문의 #(?:[0-9a-f]{8}|\d+)\]\s*$/i

/** 접수 시 저장할 제목. 비어 있으면 자리표시자, 너무 길면 자른다(제목은 목록의 한 줄이다). */
export function inquiryTitleFromSubject(subject: string | null | undefined): string {
  const trimmed = (subject ?? '').replace(/\s+/g, ' ').trim()

  if (trimmed === '') {
    return EMPTY_SUBJECT_TITLE
  }

  return trimmed.length > INQUIRY_TITLE_MAX_LENGTH
    ? `${trimmed.slice(0, INQUIRY_TITLE_MAX_LENGTH - 1)}…`
    : trimmed
}

/** 접수번호 표기. 사용자 사이트·관리자 콘솔의 `formatInquiryNo()` 와 같은 모양이다. */
export function inquiryNoTag(inquiryNo: number): string {
  return `[글자월드 문의 #${inquiryNo}]`
}

/**
 * 운영자 답신·접수 확인 메일의 제목.
 *
 * 태그가 이미 붙어 있으면(사용자가 우리 답신에 답장한 스레드) 다시 붙이지 않는다.
 */
export function replySubject(
  originalSubject: string | null | undefined,
  inquiryNo: number,
): string {
  const base = inquiryTitleFromSubject(originalSubject)
    .replace(REPLY_PREFIX_PATTERN, '')
    .replace(INQUIRY_TAG_PATTERN, '')
    .trim()
  const title = base === '' ? EMPTY_SUBJECT_TITLE : base

  return `Re: ${title} ${inquiryNoTag(inquiryNo)}`
}
