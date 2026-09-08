'use client'

import { useRouter } from 'next/navigation'
import { useId, useOptimistic, useState, useTransition } from 'react'

import { SuspensionNotice } from '@/components/board/SuspensionNotice'
import { toggleLike } from '@/lib/actions/like-actions'
import { cn } from '@/lib/utils/cn'
import { toggleLikeState } from '@/lib/utils/like-state'

import type { LikeState } from '@/lib/utils/like-state'
import type { SVGProps } from 'react'

type LikeButtonProps = {
  postId: string
  /** 서버가 읽어 온 현재 상태. */
  liked: boolean
  likeCount: number
  /** 비로그인 클릭 시 로그인 후 돌아올 경로. */
  detailPath: string
  /** 비로그인이면 왕복 없이 바로 로그인으로 보낸다. 권한 판정은 액션·RLS 가 한다. */
  isAuthenticated: boolean
  /** 뷰어 본인의 정지 안내. 넘어오면 버튼을 잠그고 이유를 아래에 적는다. */
  suspensionNotice?: string | null
}

const FAILURE_MESSAGE = '좋아요를 반영하지 못했습니다. 잠시 후 다시 시도해 주세요.'

/**
 * `/images/brand/icon-like.svg` 와 같은 path 를 인라인으로 둔 것이다.
 *
 * 파일의 fill 은 #727272 로 박혀 있어 `<Image>` 로 불러오면 눌린 상태에서 색을
 * 바꿀 수 없다. currentColor 로 그려야 버튼 글자색과 함께 물든다.
 */
function LikeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 11.1655 12"
      width="14"
      height="15"
      fill="currentColor"
      aria-hidden
      focusable="false"
      {...props}
    >
      <path d="M11.1417 5.54021L9.44589 11.5402C9.40849 11.6725 9.3286 11.7891 9.21893 11.872C9.10927 11.955 8.97552 12 8.838 12H0.63158C0.464075 12 0.30343 11.9335 0.184986 11.815C0.066542 11.6966 4.40456e-07 11.5359 4.40456e-07 11.3684V5.112C-0.000133667 4.99843 0.0303589 4.88692 0.0882675 4.78922C0.146176 4.69152 0.229358 4.61124 0.329053 4.55684L2.4319 3.41053C3.11246 3.03932 3.6736 2.48245 4.05 1.80474L4.88968 0.293684C4.99011 0.112421 5.18116 0 5.38863 0H5.46442C5.80743 0.000190407 6.13634 0.13648 6.37895 0.378947C6.64409 0.644092 6.80667 0.994639 6.83779 1.36832L6.86684 1.71663C6.92021 2.35768 6.87379 3.00347 6.72916 3.63032L6.57126 4.31368C6.55958 4.36432 6.55947 4.41695 6.57094 4.46764C6.58241 4.51833 6.60518 4.56577 6.63753 4.60644C6.66989 4.64712 6.711 4.67996 6.75781 4.70254C6.80462 4.72512 6.85592 4.73684 6.9079 4.73684H10.5332C10.6308 4.73672 10.7272 4.75926 10.8147 4.80268C10.9022 4.8461 10.9784 4.90921 11.0374 4.98707C11.0963 5.06493 11.1365 5.1554 11.1546 5.25138C11.1727 5.34736 11.1683 5.44622 11.1417 5.54021Z" />
    </svg>
  )
}

/**
 * 좋아요 토글.
 *
 * 클릭 → `useOptimistic` 으로 즉시 숫자를 움직이고, 서버 액션이 돌아오면 DB 가
 * 확정한 값으로 갈아 끼운다(그 사이 다른 사람이 누른 만큼 어긋나지 않게 액션이
 * 집계를 다시 읽어 온다).
 *
 * 상태를 props 로 계속 따라가지 않고 첫 렌더에서 한 번만 받아 오는 이유가 있다.
 * 액션이 `revalidatePath` 를 부르면 같은 트랜지션 안에서 새 props 가 내려오는데,
 * `useOptimistic` 의 기준값이 그때 바뀌면 아직 끝나지 않은 낙관적 토글이 새 값
 * 위에 한 번 더 적용되어 숫자가 튄다. 대신 글이 바뀌면(클라이언트 라우팅으로
 * 다른 상세로 이동) 그때는 확실히 다시 맞춘다.
 */
export function LikeButton({
  postId,
  liked,
  likeCount,
  detailPath,
  isAuthenticated,
  suspensionNotice = null,
}: LikeButtonProps) {
  const router = useRouter()
  const errorId = useId()

  const [state, setState] = useState<LikeState>({ liked, likeCount })
  const [trackedPostId, setTrackedPostId] = useState(postId)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [optimistic, applyToggle] = useOptimistic<LikeState, void>(state, (current) =>
    toggleLikeState(current),
  )

  if (trackedPostId !== postId) {
    setTrackedPostId(postId)
    setState({ liked, likeCount })
    setError(null)
  }

  const loginPath = `/login?next=${encodeURIComponent(detailPath)}`
  const isSuspended = suspensionNotice !== null

  const handleClick = () => {
    if (!isAuthenticated) {
      router.push(loginPath)

      return
    }

    startTransition(async () => {
      applyToggle()

      const result = await toggleLike(postId)

      if (!result.ok) {
        if (result.requiresLogin) {
          router.push(loginPath)

          return
        }

        setError(result.formError ?? FAILURE_MESSAGE)

        return
      }

      setError(null)
      setState({ liked: result.liked, likeCount: result.likeCount })
    })
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending || isSuspended}
        aria-pressed={optimistic.liked}
        aria-describedby={error === null ? undefined : errorId}
        className={cn(
          'rounded-pill inline-flex h-12 items-center gap-2 border px-7 text-ui font-medium',
          'transition-[transform,color,background-color,border-color] duration-150',
          'hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2',
          'focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-70',
          optimistic.liked
            ? 'border-[#ffc9e6] bg-[#ffe9f6] text-[#ff5fb8]'
            : 'border-line-soft text-ink shadow-chip bg-white',
        )}
      >
        <LikeIcon />
        좋아요 {optimistic.likeCount}
      </button>

      {isSuspended ? <SuspensionNotice message={suspensionNotice} compact /> : null}

      {error === null ? null : (
        <p id={errorId} role="alert" className="text-badge-red text-[14px] font-medium">
          {error}
        </p>
      )}
    </div>
  )
}
