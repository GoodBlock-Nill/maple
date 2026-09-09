import Link from 'next/link'

import { MSW_LINK_PATH } from '@/lib/utils/msw-link'
import { cn } from '@/lib/utils/cn'

/**
 * "월드 계정을 연동하면 글을 쓸 수 있습니다" 안내 배너.
 *
 * `FEATURES.postingRequiresMswLink` 가 켜져 있고 뷰어가 아직 UID 를 등록하지 않았을
 * 때만 나온다(기본 OFF). 문구는 `lib/utils/msw-link.ts` 가 만들고, 서버 액션의 폼
 * 오류와 같은 문장이다. `SuspensionNotice` 와 같은 이유로 훅 없는 순수 표시 컴포넌트다.
 */

type MswLinkNoticeProps = {
  message: string
  className?: string
}

export function MswLinkNotice({ message, className }: MswLinkNoticeProps) {
  return (
    <div
      data-testid="msw-link-notice"
      className={cn(
        'border-line-soft text-ink flex flex-col gap-2 rounded-[10px] border bg-white/80 px-4 py-3.5 text-[15px] sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className="font-medium">{message}</p>
      <Link
        href={MSW_LINK_PATH}
        className="cta-dark rounded-pill focus-visible:outline-focus inline-flex h-9 shrink-0 items-center self-start px-4 text-[14px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 sm:self-auto"
      >
        내 정보에서 연동
      </Link>
    </div>
  )
}
