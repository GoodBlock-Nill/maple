import {
  INQUIRY_ATTACHMENT_MAX_COUNT,
  INQUIRY_ATTACHMENT_MAX_MB,
  INQUIRY_ATTACHMENT_TOTAL_MAX_MB,
  INQUIRY_VIDEO_MAX_COUNT,
  INQUIRY_VIDEO_MAX_MB,
} from '@/lib/supabase/storage'
import { isInquiryCancelled } from '@/lib/utils/inquiry-permissions'

import type { BoardOption } from '@/lib/constants/board'
import type { FaqCategory, InquiryCategoryOption, InquiryStatus } from '@/types/domain'

export type SupportMenuItem = {
  href: string
  label: string
  icon: string
  /** SVG 가 48×48 흰 박스와 그림자를 직접 그리는지 여부. */
  hasOwnPlate: boolean
  /** SVG 원본 크기. 박스를 직접 그리는 자산은 62×62(박스 offset 7,5)다. */
  width: number
  height: number
}

/** 내 문의 내역 목록 경로. 상세는 이 경로 아래의 `[id]` 다. */
export const MY_INQUIRIES_PATH = '/support/inquiries'

export const SUPPORT_MENU: readonly SupportMenuItem[] = [
  {
    href: '/support',
    label: '1:1 문의하기',
    icon: '/images/support/icon-inquiry.svg',
    hasOwnPlate: true,
    width: 62,
    height: 62,
  },
  {
    href: '/support/faq',
    label: '자주 묻는 질문',
    icon: '/images/support/icon-faq.svg',
    hasOwnPlate: false,
    width: 27,
    height: 26,
  },
  {
    href: MY_INQUIRIES_PATH,
    label: '내 문의 내역',
    icon: '/images/support/icon-my-inquiries.svg',
    hasOwnPlate: false,
    width: 24,
    height: 26,
  },
]

export const SUPPORT_HEADING = '1:1 문의하기'

export const SUPPORT_DESCRIPTION =
  '이용 중 궁금한 사항이나 불편한 점을 자세히 기재하여 문의해 주세요.'

/**
 * 카테고리 폴백.
 *
 * 실제 목록은 DB(`inquiry_categories`)가 소유하고 서버 컴포넌트가 읽어 폼에 넘긴다
 * (`lib/data/inquiry-categories.ts`). 여기 있는 배열은 **조회가 실패했을 때만** 쓰인다 —
 * 카테고리를 못 읽었다고 문의 접수 자체를 막으면 "장애를 알리려는 문의"가 막힌다.
 * 프리필 양식은 담지 않는다(원문은 DB 한 곳에만 둔다). 라벨은 마이그레이션
 * 20260910000400 의 시드와 같은 순서·문구다.
 */
export const INQUIRY_CATEGORY_FALLBACK_LABELS: readonly string[] = [
  '접속·서버',
  '캐릭터·게임 진행',
  '저장·데이터',
  '재화·아이템',
  '콘텐츠·밸런스',
  '계정·이용환경',
  '기능·UI',
  '기타·건의',
]

/** 폴백 라벨을 폼이 쓰는 옵션 모양으로 올린다(설명·프리필 없음). */
export const INQUIRY_CATEGORY_FALLBACK: readonly InquiryCategoryOption[] =
  INQUIRY_CATEGORY_FALLBACK_LABELS.map((label, index) => ({
    key: `fallback-${index}`,
    label,
    description: null,
    prefill: '',
  }))

export const INQUIRY_CATEGORY_PLACEHOLDER = '카테고리를 선택해주세요'

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

export const INQUIRY_TYPES: readonly string[] = ['문의', '신고', '제안']

/**
 * 첨부 안내.
 *
 * 숫자를 문구에 박지 않고 검증 상수에서 끌어온다 — 안내와 실제 제한이 갈리면
 * 사용자는 "된다고 적힌 파일"을 고르고 오류를 본다. 시안 문구(각 200MB)는 서버
 * 액션 본문 상한을 넘겨 실제로는 접수가 통째로 실패해서 쓸 수 없다.
 */
export const ATTACHMENT_NOTICE =
  `최대 ${INQUIRY_ATTACHMENT_MAX_COUNT}개 — 이미지·PDF 는 각 ${INQUIRY_ATTACHMENT_MAX_MB}MB · 합계 ` +
  `${INQUIRY_ATTACHMENT_TOTAL_MAX_MB}MB, 영상은 각 ${INQUIRY_VIDEO_MAX_MB}MB · ` +
  `${INQUIRY_VIDEO_MAX_COUNT}개까지. (jpg, png, gif, webp, pdf, mp4, mov, webm, m4v)`

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

export type InquiryStatusOption = {
  value: InquiryStatus
  label: string
  /**
   * 완전한 Tailwind 클래스 문자열.
   * Tailwind v4 는 소스를 정적으로 스캔하므로 `bg-tag-${x}` 같은 보간은 인식하지 못한다.
   */
  className: string
}

/**
 * 상태 뱃지. 진행 중(파랑)·답변 완료(초록)는 게시판 말머리와 같은 tag 토큰 쌍을 쓰고,
 * 접수 대기는 중립 회색, 종료는 한 단계 물러난 아웃라인으로 그린다 — 끝난 문의가
 * 목록에서 시선을 끌 이유가 없다.
 */
export const INQUIRY_STATUS_MAP: Record<InquiryStatus, InquiryStatusOption> = {
  pending: { value: 'pending', label: '접수 대기', className: 'bg-tray text-ink' },
  in_progress: {
    value: 'in_progress',
    label: '처리 중',
    className: 'bg-tag-blue-bg text-tag-blue',
  },
  answered: {
    value: 'answered',
    label: '답변 완료',
    className: 'bg-tag-green-bg text-tag-green',
  },
  closed: {
    value: 'closed',
    label: '종료',
    className: 'border-line-soft text-ink-muted border bg-page-sub',
  },
}

/**
 * 접수 취소 뱃지.
 *
 * 취소한 문의는 DB 에 `status = 'closed'` 로 저장되고 `cancelled_at` 으로만
 * 구분된다. 그래서 상태 맵에는 넣지 않는다 — 맵은 `inquiry_status` enum 과 1:1
 * 이어야 관리자 화면·통계가 같은 값을 본다. 색은 종료보다 한 단계 더 물러난
 * 중립 회색이다(사용자가 스스로 끝낸 문의라 시선을 끌 이유가 없다).
 */
export const INQUIRY_CANCELLED_OPTION: InquiryStatusOption = {
  value: 'closed',
  label: '접수 취소',
  className: 'bg-tray text-ink-muted',
}

/** 목록·상세가 함께 쓰는 뱃지 판정. 취소 여부가 상태 라벨보다 우선한다. */
export function resolveInquiryStatus(
  status: InquiryStatus,
  cancelledAt: string | null,
): InquiryStatusOption {
  return isInquiryCancelled(cancelledAt) ? INQUIRY_CANCELLED_OPTION : INQUIRY_STATUS_MAP[status]
}

export const INQUIRY_STATUSES: readonly InquiryStatusOption[] = Object.values(INQUIRY_STATUS_MAP)

export const INQUIRY_STATUS_VALUES: readonly InquiryStatus[] = INQUIRY_STATUSES.map(
  (status) => status.value,
)

/** 목록 한 페이지에 추가로 쌓이는 건수. "더보기"는 1~N 페이지를 누적 표시한다. */
export const INQUIRY_PAGE_SIZE = 10

export const MY_INQUIRIES_HEADING = '내 문의 내역'

export const MY_INQUIRIES_DESCRIPTION = '접수한 1:1 문의와 운영자 답변을 확인할 수 있습니다.'

export const MY_INQUIRIES_EMPTY_TITLE = '아직 남긴 문의가 없습니다'

export const MY_INQUIRIES_EMPTY_DESCRIPTION = '이용 중 궁금한 점이 생기면 1:1 문의를 남겨 주세요.'

export const INQUIRY_SUBMIT_LABEL = '문의하기'

/** 접수 직후 상세로 리다이렉트될 때 한 번만 뜨는 완료 모달(`?submitted=1`). */
export const INQUIRY_SUBMITTED_PARAM = 'submitted'

export const INQUIRY_SUBMITTED_TITLE = '문의가 접수되었습니다'

export const INQUIRY_SUBMITTED_DESCRIPTION =
  '운영자가 확인 후 답변을 등록하면 이 페이지와 내 문의 내역에서 확인할 수 있습니다.'

export const INQUIRY_SUBMITTED_CONFIRM_LABEL = '확인'

export const MY_INQUIRIES_LINK_LABEL = '내 문의 내역 보기'

export const INQUIRY_REPLY_HEADING = '답변'

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

export const INQUIRY_EDIT_HEADING = '문의 수정'

export const INQUIRY_EDIT_DESCRIPTION = '접수 대기 중인 문의만 수정할 수 있습니다.'

export const INQUIRY_EDIT_SUBMIT_LABEL = '수정 완료'

export const INQUIRY_EXISTING_ATTACHMENT_HEADING = '기존 첨부파일'

/** 체크하면 저장 시 그 첨부를 뺀다. 체크 상태를 폼이 그대로 서버로 넘긴다. */
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
