import { INQUIRY_KIND_MAP } from '@/lib/constants/inquiry-kind'

import type { BoardOption } from '@/lib/constants/board'
import type { InquiryKind } from '@/lib/constants/inquiry-kind'
import type { FaqCategory } from '@/types/domain'

/** 내 문의 내역 목록 경로. 상세는 이 경로 아래의 `[id]` 다. */
export const MY_INQUIRIES_PATH = '/support/inquiries'

export const INQUIRY_CATEGORY_PLACEHOLDER = '카테고리를 선택해주세요'

/* -------------------------------------------------------------------------
 * 메이플월드 계정 ID (2026-09-11 부터 필수)
 * ---------------------------------------------------------------------- */

export const INQUIRY_ACCOUNT_LABEL = '메이플월드 계정 ID'

export const INQUIRY_ACCOUNT_PLACEHOLDER = '예: 20123456789000000'

/** 쿠폰 등록·마이페이지와 같은 문장을 쓴다 — 같은 값을 두 화면이 다르게 부르지 않는다. */
export const INQUIRY_ACCOUNT_HELP =
  '계정 ID는 “메이플월드 - 설정 - 계정 정보” 를 통해서 확인할 수 있습니다.'

/**
 * 필수 항목이 덜 채워졌을 때 제출 버튼 아래에 서는 안내.
 *
 * 버튼을 잠그기만 하면 사용자는 왜 눌리지 않는지 모른다 — 비로그인 안내와 같은
 * 자리에 이유를 적는다.
 */
export const INQUIRY_REQUIRED_NOTICE = '필수 항목(*)을 모두 입력해 주세요.'

/**
 * 프리필 교체 확인.
 *
 * 카테고리를 바꾸면 그 카테고리의 양식으로 **갈아 끼운다**(docs/1on1.md). 사용자가
 * 직접 쓴 내용이 남아 있을 때만 물어본다 — 이전 양식 그대로면 잃을 것이 없어
 * 확인을 세울 이유가 없다.
 */
export const INQUIRY_PREFILL_CONFIRM_TITLE = '작성 중인 내용이 지워집니다'

export const INQUIRY_PREFILL_CONFIRM_DESCRIPTION = '카테고리를 바꿀까요?'

export const INQUIRY_PREFILL_CONFIRM_LABEL = '카테고리 변경'

/**
 * 세부 문의 유형 셀렉트의 안내 문구.
 *
 * 카테고리를 고르기 전에는 보여 줄 항목이 없다 — 빈 셀렉트를 눌러 보게 두지 않고
 * 무엇을 먼저 해야 하는지 그 자리에 적는다.
 */
export const INQUIRY_SUBTYPE_PLACEHOLDER = '세부 문의 유형을 선택해주세요'

export const INQUIRY_SUBTYPE_LOCKED_PLACEHOLDER = '카테고리를 먼저 선택해주세요'

export const PRIVACY_CONSENT_LABEL = '개인정보 수집 및 이용에 동의합니다.'

export const PRIVACY_CONSENT_LINK_LABEL = '내용 보기'

export const PRIVACY_POLICY_PATH = '/policy/privacy'

/** 인증 연동 전까지 문의 등록 버튼에 붙는 안내 문구. */
export const LOGIN_REQUIRED_INQUIRY_NOTICE = '로그인 후 문의할 수 있습니다'

export const FAQ_CATEGORIES = [
  { value: 'notice', label: '공지사항' },
  { value: 'account', label: '계정' },
  { value: 'payment', label: '결제' },
  { value: 'bug', label: '버그' },
  { value: 'etc', label: '기타' },
] as const satisfies readonly BoardOption<FaqCategory>[]

export const FAQ_CATEGORY_VALUES = FAQ_CATEGORIES.map((category) => category.value)

/* -------------------------------------------------------------------------
 * 내 문의 내역
 * ---------------------------------------------------------------------- */

/**
 * 목록 한 페이지의 건수(시안 v2: 카드 6장).
 *
 * 누적 "더보기"가 번호 페이지네이션으로 바뀌면서 `?page=N` 은 **N 페이지만** 그린다.
 * 6 은 시안의 카드 수이자 카드 최소 높이(667)를 채우는 수다.
 */
export const INQUIRY_PAGE_SIZE = 6

export const MY_INQUIRIES_HEADING = '내 문의 내역'

export const MY_INQUIRIES_EMPTY_TITLE = '아직 남긴 문의가 없습니다'

export const MY_INQUIRIES_EMPTY_DESCRIPTION = '이용 중 궁금한 점이 생기면 1:1 문의를 남겨 주세요.'

/**
 * 빈 목록의 행동 버튼 문구.
 *
 * 세 창구 중 1:1 문의로 보낸다 — 남길 것이 없어 비어 있는 화면에서 "무엇을
 * 제보할지"부터 고르게 하면 한 단계가 더 늘어난다. 문구는 그 창구의 제출 문구와
 * 같은 자리에서 가져와 버튼과 폼이 다른 말을 하지 않게 한다.
 */
export const INQUIRY_SUBMIT_LABEL = INQUIRY_KIND_MAP.inquiry.submitLabel

/** 접수 직후 상세로 리다이렉트될 때 한 번만 뜨는 완료 모달(`?submitted=1`). */
export const INQUIRY_SUBMITTED_PARAM = 'submitted'

export type InquirySubmittedCopy = {
  title: string
  description: string
}

/**
 * 접수 완료 모달 문구 — 창구(kind)별.
 *
 * 버그제보·불법이용제보는 "문의"가 아니라 "제보"다. 접수 직후 화면이 사용자가 방금
 * 누른 버튼("제보하기")과 다른 말을 하면, 제대로 접수된 것인지부터 의심하게 된다.
 * 두 제보 창구는 같은 문구를 쓴다 — 처리 흐름(운영자 확인 → 답변)이 같다.
 */
const SUBMITTED_REPORT_COPY: InquirySubmittedCopy = {
  title: '제보가 접수되었습니다',
  description: '운영자가 제보를 확인한 뒤 이 페이지와 내 문의 내역에 결과를 남깁니다.',
}

export const INQUIRY_SUBMITTED_COPY: Record<InquiryKind, InquirySubmittedCopy> = {
  inquiry: {
    title: '문의가 접수되었습니다',
    description:
      '운영자가 확인 후 답변을 등록하면 이 페이지와 내 문의 내역에서 확인할 수 있습니다.',
  },
  bug: SUBMITTED_REPORT_COPY,
  report: SUBMITTED_REPORT_COPY,
}

/**
 * 접수 완료 모달의 접수번호 줄.
 *
 * 번호를 **접수 직후에 한 번 더** 보여 준다 — 사용자가 화면을 닫기 전에 적어 둘 수
 * 있어야 고객센터 문의가 한 번에 이어진다(`#1024` 표기는 `lib/utils/inquiry-no.ts`).
 */
export function inquirySubmittedReceiptNotice(formattedNo: string): string {
  return `접수번호 ${formattedNo} — 문의 내역에서 확인할 수 있습니다.`
}

export const INQUIRY_SUBMITTED_CONFIRM_LABEL = '확인'

export const MY_INQUIRIES_LINK_LABEL = '내 문의 내역 보기'

export const INQUIRY_REPLY_HEADING = '답변'

/** 상세 본문 상자 위의 소제목. 시안 v2 에서 제목 줄과 본문을 가르는 표시다. */
export const INQUIRY_CONTENT_HEADING = '문의내용'

/** 상세·수정 화면 맨 위의 뒤로 가기 링크 문구. */
export const INQUIRY_BACK_TO_LIST_LABEL = '내 문의 내역으로'

export const INQUIRY_BACK_TO_DETAIL_LABEL = '문의로 돌아가기'

export const INQUIRY_NO_REPLY_NOTICE = '운영자가 확인 중입니다. 답변이 등록되면 이곳에 표시됩니다.'

/** 접수 취소된 문의(답변 없음)의 안내. 처리 중 문구와 구분해 다시 확인할 것이 없음을 알린다. */
export const INQUIRY_CANCELLED_NO_REPLY_NOTICE = '접수가 취소된 문의입니다.'

/** 답변 없이 종료된 문의의 안내. 재문의는 새 글로 남겨야 한다는 것까지 알려 준다. */
export const INQUIRY_CLOSED_NO_REPLY_NOTICE =
  '운영자 검토 후 종료된 문의입니다. 추가 문의는 새 1:1 문의로 남겨 주세요.'

/** 처리 중이며 아직 답변이 없는 문의의 안내. 대기 중 문구와 구분해 진행 상태를 알린다. */
export const INQUIRY_IN_PROGRESS_NO_REPLY_NOTICE =
  '운영자가 처리 중입니다. 답변이 등록되면 이곳에 표시됩니다.'

export const INQUIRY_ATTACHMENT_HEADING = '첨부파일'

/* -------------------------------------------------------------------------
 * 소유자 동작 — 수정 · 접수 취소
 * ---------------------------------------------------------------------- */

export const INQUIRY_EDIT_LABEL = '수정'

export const INQUIRY_CANCEL_LABEL = '접수 취소'

export const INQUIRY_CANCEL_CONFIRM_TITLE = '문의 접수를 취소할까요?'

export const INQUIRY_CANCEL_CONFIRM_DESCRIPTION = '취소한 문의는 되돌릴 수 없습니다.'

export const INQUIRY_CANCEL_CONFIRM_LABEL = '접수 취소'

export const INQUIRY_EDIT_SUBMIT_LABEL = '수정 완료'

export const INQUIRY_EXISTING_ATTACHMENT_HEADING = '기존 첨부파일'

/**
 * 칩의 X 버튼이 읽히는 이름.
 *
 * 누르면 곧바로 지우는 것이 아니라 "저장할 때 뺄 것"으로 표시한다 — 실제 삭제는
 * 수정이 성공한 뒤 서버 액션이 한다. 표시된 경로는 숨은 입력으로 그대로 전송된다.
 */
export const INQUIRY_ATTACHMENT_REMOVE_LABEL = '삭제'

export const INQUIRY_ATTACHMENT_REMOVE_FIELD = 'removeAttachments'

/**
 * 리다이렉트로 전달되는 1회성 안내 파라미터.
 * 값이 아니라 존재 여부로 판정하므로 전부 `=1` 로 붙인다.
 */
export const INQUIRY_UPDATED_PARAM = 'updated'

export const INQUIRY_CANCELLED_PARAM = 'cancelled'

export const INQUIRY_EDIT_LOCKED_PARAM = 'locked'

export const INQUIRY_UPDATED_NOTICE = '문의가 수정되었습니다'

export const INQUIRY_CANCELLED_NOTICE = '문의 접수를 취소했습니다.'

export const INQUIRY_EDIT_LOCKED_NOTICE = '접수 대기 상태의 문의만 수정할 수 있습니다.'
