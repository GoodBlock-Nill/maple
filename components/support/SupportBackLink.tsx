import Link from 'next/link'

import { ArrowBackIcon } from '@/components/support/support-icons'
import { SUPPORT_BACK_LINK_CLASS } from '@/components/support/support-styles'

type SupportBackLinkProps = {
  href: string
  label: string
}

/**
 * 상세·수정 화면 맨 위의 뒤로 가기(시안 v2).
 *
 * 시안 v1 에서 화면 맨 아래에 있던 "목록으로" 알약을 대체한다 — 답변이 길면
 * 아래쪽 버튼은 스크롤 끝에 묻혀서, 돌아갈 길을 찾으려면 먼저 끝까지 내려야 했다.
 */
export function SupportBackLink({ href, label }: SupportBackLinkProps) {
  return (
    <Link href={href} className={SUPPORT_BACK_LINK_CLASS}>
      <ArrowBackIcon className="size-5 shrink-0 lg:size-6" />
      {label}
    </Link>
  )
}
