'use client'

import { useEffect } from 'react'

/**
 * 저장하지 않은 편집이 있을 때 이탈을 막는다.
 *
 * 약관 본문은 한 번에 수십 분을 들여 다듬는 문서다. 탭을 잘못 닫거나 주소창으로
 * 다른 화면에 가면 그 시간이 통째로 사라지는데, 초안은 서버에 자동 저장되지 않는다.
 *
 * `beforeunload` 는 **브라우저 이탈**(새로고침 · 탭 닫기 · 외부 링크)만 잡는다.
 * Next 의 클라이언트 전환(`<Link>`)에는 걸리지 않는다 — 그쪽까지 막으려면 라우터를
 * 가로채야 하고, 그러면 저장 후 리다이렉트까지 함께 막혀 저장이 끝나지 않는다.
 *
 * 문구는 지정하지 않는다. 최신 브라우저는 커스텀 메시지를 무시하고 자체 문구만
 * 보여 주므로, `preventDefault()` 로 "물어봐 달라"는 신호만 남긴다.
 */
export function useUnsavedGuard(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) {
      return
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])
}
