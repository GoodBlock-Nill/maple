import { Badge } from '@/components/ui'

/**
 * "회원 답장" 뱃지 — 목록·회원 상세의 상태 뱃지 옆에 선다.
 *
 * 판정 기준은 `inquiries.user_replied_at` **하나뿐**이다(20260914000400). 트리거가
 * 회원 답장에 값을 찍고 운영자 답변에 지우므로, 값이 있다는 것은 곧 "공이 운영자에게
 * 넘어와 있다"는 뜻이다. 상태(처리 중)만으로는 그 차례를 알 수 없다.
 *
 * 색은 `warn` 이다. 상태 뱃지가 쓰는 회색·파랑·초록과 부딪히지 않으면서 "손이 필요한
 * 줄"로 읽혀야 하기 때문이다 — 스레드 안의 회원 답장 상자(accent)와는 자리가 달라
 * 색이 겹칠 일이 없다.
 */
export function InquiryMemberReplyBadge({ userRepliedAt }: { userRepliedAt: string | null }) {
  if (userRepliedAt === null || userRepliedAt === '') {
    return null
  }

  return <Badge tone="warn">회원 답장</Badge>
}
