import { INQUIRY_ATTACHMENT_MAX_COUNT, INQUIRY_ATTACHMENT_TOTAL_MAX_MB } from '@/lib/supabase/storage'
import { INQUIRY_CONTENT_MAX } from '@/lib/validation/inquiry'

/**
 * 문의 대화 스레드(회원 답장)의 문구·상한.
 *
 * 같은 말을 화면·서버 액션·안내가 나눠 쓰기 때문에 한곳에 모은다 — 문구가 갈리면
 * "폼에서는 된다고 하고 서버는 거절하는" 경계가 생긴다(docs/reference/inquiry-thread-spec.md §3).
 */

/** 스레드에서 내 답장의 머리줄. 운영자 쪽은 저장된 작성자 이름을 그대로 쓴다. */
export const INQUIRY_USER_REPLY_LABEL = '내 답변'

export const INQUIRY_USER_REPLY_FIELD_LABEL = '답장 내용'

export const INQUIRY_USER_REPLY_PLACEHOLDER = '운영자가 요청한 내용을 남겨 주세요.'

export const INQUIRY_USER_REPLY_SUBMIT_LABEL = '답장 보내기'

export const INQUIRY_USER_REPLY_PENDING_LABEL = '보내는 중…'

/**
 * RPC(`add_inquiry_user_reply`)가 받아 주는 본문 상한.
 *
 * 접수 폼의 `INQUIRY_CONTENT_MAX` 는 카테고리 양식을 담느라 더 넉넉한데, 답장은
 * 그 양식을 쓰지 않아 함수 쪽이 2000자에서 끊는다. 둘 중 **작은 쪽**을 폼 상한으로
 * 두어야 사용자가 다 쓴 뒤에 거절당하지 않는다.
 */
const USER_REPLY_RPC_MAX = 2_000

export const INQUIRY_USER_REPLY_MAX = Math.min(USER_REPLY_RPC_MAX, INQUIRY_CONTENT_MAX)

/** 마지막 운영자 답변 이후 보낼 수 있는 답장 수. RPC 의 `too_many` 판정과 같은 값이다. */
export const INQUIRY_USER_REPLY_WINDOW = 3

export const INQUIRY_USER_REPLY_REQUIRED_MESSAGE = '답장 내용을 입력해 주세요.'

export const INQUIRY_USER_REPLY_TOO_LONG_MESSAGE = `답장은 ${INQUIRY_USER_REPLY_MAX}자 이하로 입력해 주세요.`

/* -------------------------------------------------------------------------
 * 답장을 보낼 수 없을 때의 한 줄 안내
 * ---------------------------------------------------------------------- */

/** 답변이 끝난 문의. 대화는 닫히고 다시 열리지 않는다(오너 확정 규칙 §1). */
export const INQUIRY_REPLY_CLOSED_NOTICE =
  '답변이 완료된 문의입니다. 추가 문의는 새 문의로 접수해 주세요.'

/** 아직 운영자 답변이 없다. 접수 대기와 "처리 중이지만 답변 전"이 같은 상황이다. */
export const INQUIRY_REPLY_WAITING_NOTICE = '운영자 답변 후 답장할 수 있습니다.'

export const INQUIRY_REPLY_TOO_MANY_NOTICE = `운영자 답변을 기다려 주세요. 답장은 운영자 답변 사이에 ${INQUIRY_USER_REPLY_WINDOW}건까지 보낼 수 있습니다.`

/* -------------------------------------------------------------------------
 * 서버 액션 결과
 * ---------------------------------------------------------------------- */

export const INQUIRY_REPLY_LOGIN_MESSAGE = '로그인 후 이용할 수 있습니다.'

export const INQUIRY_REPLY_FAILURE_MESSAGE = '답장을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.'

export const INQUIRY_REPLY_NOT_FOUND_MESSAGE = '문의를 찾을 수 없습니다.'

export const INQUIRY_REPLY_CANCELLED_MESSAGE = '접수가 취소된 문의에는 답장할 수 없습니다.'

/* 첨부 상한은 접수 폼과 같은 상수에서 끌어온다 — 문구가 규칙과 갈리면(2026-09-14 5개·200MB 통일) 사용자가 틀린 안내를 본다. */
export const INQUIRY_REPLY_INVALID_MESSAGE = `답장은 1~${INQUIRY_USER_REPLY_MAX}자, 첨부는 형식에 관계없이 최대 ${INQUIRY_ATTACHMENT_MAX_COUNT}개 · 총 ${INQUIRY_ATTACHMENT_TOTAL_MAX_MB}MB 까지 보낼 수 있습니다.`

/**
 * RPC 실패 코드 → 한국어 문구.
 *
 * 목록은 함수 주석의 코드 집합과 1:1 이다(마이그레이션 20260914000400 §6). 없는
 * 문의와 남의 문의가 모두 `not_owner` 인 것은 DB 쪽 의도다 — 둘을 갈라 안내하면
 * 이 액션이 "그 uuid 의 문의가 있는가"를 알려 주는 조회기가 된다.
 */
export const INQUIRY_REPLY_ERROR_MESSAGE: Record<string, string> = {
  not_owner: INQUIRY_REPLY_NOT_FOUND_MESSAGE,
  cancelled: INQUIRY_REPLY_CANCELLED_MESSAGE,
  not_in_progress: INQUIRY_REPLY_CLOSED_NOTICE,
  no_operator_reply: INQUIRY_REPLY_WAITING_NOTICE,
  too_many: INQUIRY_REPLY_TOO_MANY_NOTICE,
  invalid: INQUIRY_REPLY_INVALID_MESSAGE,
}

/** `invalid` 만 사용자가 고칠 수 있는 칸을 짚어 준다. 나머지는 폼 위의 한 줄이다. */
export const INQUIRY_REPLY_ERROR_FIELD: Record<string, 'content'> = {
  invalid: 'content',
}

/** 답장 직후 상세로 돌아올 때 한 번만 뜨는 안내(`?replied=1`). */
export const INQUIRY_REPLIED_PARAM = 'replied'

export const INQUIRY_REPLIED_NOTICE = '답장을 보냈습니다.'
