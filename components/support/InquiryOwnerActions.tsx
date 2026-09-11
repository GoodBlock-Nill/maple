import Link from 'next/link'

import { CancelInquiryButton } from '@/components/support/CancelInquiryButton'
import { SUPPORT_ACTION_EDIT_CLASS } from '@/components/support/support-styles'
import { INQUIRY_EDIT_LABEL, MY_INQUIRIES_PATH } from '@/lib/constants/support'
import { canCancelInquiry, canEditInquiry } from '@/lib/utils/inquiry-permissions'

import type { InquiryStatus } from '@/types/domain'

type InquiryOwnerActionsProps = {
  inquiryId: string
  status: InquiryStatus
  cancelledAt: string | null
}

/**
 * 상세 헤더의 소유자 액션 줄.
 *
 * 접수 대기에는 수정 · 접수 취소, 처리 중에는 접수 취소만, 그 밖(답변 완료 ·
 * 종료 · 이미 취소함)에는 아무것도 두지 않는다. 여기서 하는 분기는 **표시용**이고
 * 실제 권한은 서버 액션과 DB 가드가 강제한다 — 판정 문장을 화면과 서버가 함께
 * 쓰도록 `lib/utils/inquiry-permissions` 한곳에 두었다.
 */
export function InquiryOwnerActions({ inquiryId, status, cancelledAt }: InquiryOwnerActionsProps) {
  const subject = { status, cancelledAt }
  const showEdit = canEditInquiry(subject)
  const showCancel = canCancelInquiry(subject)

  if (!showEdit && !showCancel) {
    return null
  }

  return (
    <div className="flex items-center gap-2 lg:gap-3">
      {showEdit ? (
        <Link href={`${MY_INQUIRIES_PATH}/${inquiryId}/edit`} className={SUPPORT_ACTION_EDIT_CLASS}>
          {INQUIRY_EDIT_LABEL}
        </Link>
      ) : null}
      {showCancel ? <CancelInquiryButton inquiryId={inquiryId} /> : null}
    </div>
  )
}
