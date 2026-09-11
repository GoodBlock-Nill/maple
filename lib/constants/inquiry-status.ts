import { isInquiryCancelled } from '@/lib/utils/inquiry-permissions'

import type { InquiryStatus } from '@/types/domain'

/**
 * 문의 상태 표기(시안 v2).
 *
 * 라벨·색·모양을 한곳에 모아 목록·상세·마이페이지가 같은 규칙을 보게 한다.
 * 고객지원 상수(`lib/constants/support.ts`)에서 떼어 낸 이유는 그 파일이 문구·경로·
 * 카테고리까지 함께 들고 있어, 상태 규칙이 그 사이에 묻히기 때문이다.
 */

/**
 * 상태를 그리는 두 가지 모양.
 *
 * `pill` 은 회색 알약, `text` 는 알약 없는 색 글자다. 시안 v2 에서 답변 완료만
 * 알약을 벗고 분홍 글자가 됐다 — "끝났다"는 신호를 목록에서 한눈에 찾게 하려는
 * 구분이라, 모양 판정을 색 클래스와 함께 상태표에 둔다(화면마다 분기하지 않는다).
 */
export type InquiryStatusVariant = 'pill' | 'text'

export type InquiryStatusOption = {
  value: InquiryStatus
  label: string
  variant: InquiryStatusVariant
  /**
   * 완전한 Tailwind 클래스 문자열.
   * Tailwind v4 는 소스를 정적으로 스캔하므로 `bg-tag-${x}` 같은 보간은 인식하지 못한다.
   */
  className: string
}

/**
 * 상태 뱃지(시안 v2 실측).
 *
 * 접수 대기·종료는 중립 회색 알약(#f1f1f5/#727272), 처리 중은 같은 알약에 보라빛
 * 글자(#625b71), 답변 완료는 알약 없이 분홍 글자(#e8308a)다. 색 자체가 유일한
 * 구분 수단은 아니다 — 라벨이 늘 함께 있다.
 */
const STATUS_PILL_CLASS = 'bg-[#f1f1f5] text-[#727272]'

export const INQUIRY_STATUS_MAP: Record<InquiryStatus, InquiryStatusOption> = {
  pending: {
    value: 'pending',
    label: '접수 대기',
    variant: 'pill',
    className: STATUS_PILL_CLASS,
  },
  in_progress: {
    value: 'in_progress',
    label: '처리 중',
    variant: 'pill',
    className: 'bg-[#f1f1f5] text-[#625b71]',
  },
  answered: {
    value: 'answered',
    label: '답변 완료',
    variant: 'text',
    className: 'text-[#e8308a]',
  },
  closed: {
    value: 'closed',
    label: '종료',
    variant: 'pill',
    className: STATUS_PILL_CLASS,
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
  variant: 'pill',
  className: STATUS_PILL_CLASS,
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
