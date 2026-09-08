'use client'

import { useEffect } from 'react'

type FlashNoticeProps = {
  /** 주소에서 지울 쿼리 파라미터 이름. */
  param: string
  message: string
}

/**
 * 리다이렉트로 전달된 1회성 안내(`/community?deleted=1`).
 *
 * 노출 여부는 서버가 정하고(페이지가 searchParams 를 읽는다), 이 컴포넌트는 주소
 * 정리만 맡는다. `router.replace()` 를 쓰면 서버가 페이지를 다시 그리면서 안내가
 * 곧바로 사라지므로, 재렌더를 일으키지 않는 `history.replaceState` 로 지운다.
 * 그래서 새로고침·공유 링크에서는 다시 뜨지 않는다.
 */
export function FlashNotice({ param, message }: FlashNoticeProps) {
  useEffect(() => {
    const url = new URL(window.location.href)

    if (!url.searchParams.has(param)) {
      return
    }

    url.searchParams.delete(param)
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [param])

  return (
    <p
      role="status"
      className="border-line-soft text-ink rounded-panel mt-6 border bg-white/80 px-5 py-3 text-[15px]"
    >
      {message}
    </p>
  )
}
