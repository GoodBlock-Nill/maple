/**
 * 제목 규칙.
 *
 * 답신 제목은 `Re: <원제목> [문의 #<짧은 id>]`. 짧은 id 는 운영자와 사용자가 전화·채팅으로
 * 같은 문의를 가리킬 때 부르는 이름이라 uuid 앞 8자로 짧게 둔다(충돌해도 조회 키는
 * thread_key · uuid 다).
 */

export const INQUIRY_TITLE_MAX_LENGTH = 200

export const EMPTY_SUBJECT_TITLE = '(제목 없음)'

const SHORT_ID_LENGTH = 8

/* 앉힐 때 이미 붙어 있는 회신 접두사는 걷어낸다 — `Re: Re: Re:` 가 쌓이는 것을 막는다. */
const REPLY_PREFIX_PATTERN = /^(?:\s*(?:re|답장|회신|aw|fwd?|fw)\s*:\s*)+/i

const INQUIRY_TAG_PATTERN = /\s*\[문의 #[0-9a-f]{8}\]\s*$/i

export function shortInquiryId(inquiryId: string): string {
  return inquiryId.replace(/-/g, '').slice(0, SHORT_ID_LENGTH)
}

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

/**
 * 운영자 답신·접수 확인 메일의 제목.
 *
 * `[문의 #xxxxxxxx]` 가 이미 붙어 있으면(사용자가 우리 답신에 답장한 스레드) 다시 붙이지 않는다.
 */
export function replySubject(
  originalSubject: string | null | undefined,
  inquiryId: string,
): string {
  const base = inquiryTitleFromSubject(originalSubject)
    .replace(REPLY_PREFIX_PATTERN, '')
    .replace(INQUIRY_TAG_PATTERN, '')
    .trim()
  const title = base === '' ? EMPTY_SUBJECT_TITLE : base

  return `Re: ${title} [문의 #${shortInquiryId(inquiryId)}]`
}
