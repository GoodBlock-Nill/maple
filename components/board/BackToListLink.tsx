import Link from 'next/link'

import { BOARD_PILL_CLASS } from '@/components/board/board-styles'

type BackToListLinkProps = {
  href: string
  label?: string
}

export function BackToListLink({ href, label = '목록으로' }: BackToListLinkProps) {
  return (
    <div className="flex justify-center pt-16 pb-10 xl:pb-0">
      <Link href={href} className={BOARD_PILL_CLASS}>
        {label}
      </Link>
    </div>
  )
}
