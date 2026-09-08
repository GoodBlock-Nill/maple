import Link from 'next/link'

import { BOARD_ACTION_CLASS } from '@/components/board/board-styles'
import { DeletePostButton } from '@/components/board/DeletePostButton'
import { ReportDialog } from '@/components/board/ReportDialog'
import { isAuthor } from '@/lib/utils/authorship'

type PostActionsProps = {
  postId: string
  authorId: string | null
  /** 로그인한 사용자의 uuid. 비로그인이면 null. */
  viewerId: string | null
  /** 로그인 유도 링크의 복귀 경로. */
  detailPath: string
  /** 뷰어 본인의 정지 안내. 신고 다이얼로그가 그대로 그린다. */
  suspensionNotice?: string | null
}

/**
 * 상세 헤더의 액션 줄.
 *
 * 작성자에게는 수정·삭제를, 그 외 로그인 사용자에게는 신고를 준다. 비로그인
 * 사용자에게도 신고 버튼을 보여 주되 로그인으로 안내한다(버튼 자체를 감추면
 * 신고할 방법이 있다는 사실조차 알 수 없다).
 *
 * 여기서 하는 분기는 표시용이다. 실제 권한은 서버 액션과 RLS 가 강제한다.
 */
export function PostActions({
  postId,
  authorId,
  viewerId,
  detailPath,
  suspensionNotice = null,
}: PostActionsProps) {
  if (isAuthor(authorId, viewerId)) {
    return (
      <div className="flex items-center gap-2">
        <Link href={`${detailPath}/edit`} className={BOARD_ACTION_CLASS}>
          수정
        </Link>
        <DeletePostButton postId={postId} />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {viewerId === null ? (
        <Link href={`/login?next=${encodeURIComponent(detailPath)}`} className={BOARD_ACTION_CLASS}>
          신고
        </Link>
      ) : (
        <ReportDialog
          targetType="post"
          targetId={postId}
          nextPath={detailPath}
          suspensionNotice={suspensionNotice}
        />
      )}
    </div>
  )
}
