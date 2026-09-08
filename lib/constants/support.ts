import type { BoardOption } from '@/lib/constants/board'
import type { FaqCategory, InquiryStatus } from '@/types/domain'

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

export const INQUIRY_CATEGORIES: readonly string[] = ['계정', '결제', '버그', '신고', '기타']

export const INQUIRY_TYPES: readonly string[] = ['문의', '신고', '제안']

export const ATTACHMENT_NOTICE = '최대 3개, 각 200MB 이하. (확장자: jpg, png, gif, pdf)'

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

export const INQUIRY_ATTACHMENT_HEADING = '첨부파일'
