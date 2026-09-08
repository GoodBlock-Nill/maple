import Link from 'next/link'

import { BOARD_PILL_CLASS } from '@/components/board/board-styles'

type LoadMoreButtonProps = {
  href: string
  shown: number
  total: number
  /**
   * 랭킹처럼 라벨의 분모(전체 인원)와 실제 남은 행 수가 다른 목록을 위한 우회.
   * 지정하지 않으면 `shown < total` 로 판단한다.
   */
  hasMore?: boolean
}

/**
 * 누적 "더보기". 전부 표시된 상태에서는 렌더하지 않는다.
 * 라벨은 시안 그대로 `더보기(표시수/전체수)`.
 */
export function LoadMoreButton({ href, shown, total, hasMore }: LoadMoreButtonProps) {
  if (!(hasMore ?? shown < total)) {
    return null
  }

  return (
    <div className="flex justify-center pt-16 pb-10 xl:pb-0">
      <Link href={href} className={BOARD_PILL_CLASS}>
        더보기({shown}/{total})
      </Link>
    </div>
  )
}
