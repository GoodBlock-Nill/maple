import type { InquiryStatus } from '@/types/domain'

/**
 * 소유자가 문의에 할 수 있는 동작 판정.
 *
 * **화면 분기용**이다. 실제 권한은 서버 액션의 재확인과 DB 가드
 * (`guard_inquiry_owner_update()`)가 강제하므로, 여기를 우회해도 답변이 시작된
 * 문의는 고쳐지지 않는다. 판정 규칙을 한곳에 모아 두는 이유는 목록·상세·수정
 * 화면·서버 액션이 **같은 문장**을 쓰게 하기 위해서다 — 화면마다 조건을 다시
 * 적으면 버튼은 보이는데 저장은 거절되는 상태가 조용히 생긴다.
 */

/** 판정에 필요한 최소 정보. 목록 행(요약)도 그대로 넘길 수 있다. */
export type InquiryActionSubject = {
  status: InquiryStatus
  cancelledAt: string | null
}

/** 취소할 수 있는 상태. 답변이 등록된 뒤(answered)에는 취소가 의미를 잃는다. */
const CANCELLABLE_STATUSES: readonly InquiryStatus[] = ['pending', 'in_progress']

export function isInquiryCancelled(cancelledAt: string | null | undefined): boolean {
  return typeof cancelledAt === 'string' && cancelledAt !== ''
}

/**
 * 수정 가능 여부.
 *
 * 접수 대기에서만 연다. 운영자가 이미 확인을 시작한 문의(처리 중 이후)의 본문이
 * 바뀌면 답변의 근거가 사라져 이력을 추적할 수 없다.
 */
export function canEditInquiry({ status, cancelledAt }: InquiryActionSubject): boolean {
  return status === 'pending' && !isInquiryCancelled(cancelledAt)
}

/** 접수 취소 가능 여부. 이미 취소한 문의는 다시 취소하지 않는다(되돌리기도 없다). */
export function canCancelInquiry({ status, cancelledAt }: InquiryActionSubject): boolean {
  return CANCELLABLE_STATUSES.includes(status) && !isInquiryCancelled(cancelledAt)
}
