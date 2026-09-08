'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

import { useFocusTrap } from '@/components/layout/use-focus-trap'
import { cn } from '@/lib/utils/cn'

import type { ReactNode } from 'react'

type DialogShellProps = {
  open: boolean
  onClose: () => void
  /** 제목 요소의 id. `aria-labelledby` 로 연결된다. */
  labelledBy: string
  describedBy?: string
  className?: string
  children: ReactNode
}

/**
 * 모달 껍데기(딤 · 포커스 트랩 · Escape · 스크롤 잠금)만 담당한다.
 *
 * 닫힐 때는 트리 전체를 언마운트한다. 그래야 안에 있는 `useActionState` 도 함께
 * 초기화되어, 다시 열었을 때 지난 제출의 성공/오류 문구가 남아 있지 않는다.
 * 포커스 복원은 `useFocusTrap` 의 cleanup 이 처리한다(열기 직전 요소로 되돌린다).
 *
 * `<dialog showModal()>` 대신 직접 구현한 이유: showModal 은 top layer 로 올라가
 * 페이지 스택 밖에서 렌더되는데, 서버 액션 리다이렉트로 라우트가 바뀔 때 열린
 * 상태가 남아 화면이 잠기는 사례가 있다. 여기서는 상태를 React 가 온전히 소유한다.
 *
 * 대신 `document.body` 로 포털한다. 게시판 상세는 글래스 표면(`backdrop-filter`)
 * 안에서 렌더되는데, backdrop-filter/transform 이 걸린 조상은 `position: fixed` 의
 * 기준 상자가 되어 모달이 그 카드 안에서 잘린다(실제로 다이얼로그 아랫부분이
 * 잘리는 것을 스크린샷으로 확인했다).
 */

/* SSR·하이드레이션 중에는 false, 그 뒤 true. effect 안에서 setState 하지 않고도
   "클라이언트인가"를 알 수 있어 하이드레이션 불일치가 생기지 않는다. */
const subscribeToNothing = () => () => {}

function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  )
}
export function DialogShell({
  open,
  onClose,
  labelledBy,
  describedBy,
  className,
  children,
}: DialogShellProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const isClient = useIsClient()

  useFocusTrap(panelRef, open)

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  if (!open || !isClient) {
    return null
  }

  return createPortal(
    /* 모바일은 바텀시트(아래 정렬 · 위쪽만 라운드), sm 이상은 가운데 카드. */
    <div className="fixed inset-0 z-80 flex items-end justify-center overflow-y-auto sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 -z-10 block h-full w-full cursor-default bg-black/50"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={cn(
          'bg-surface relative my-0 w-full max-w-[440px] rounded-t-[20px] p-6 shadow-[0_18px_48px_rgb(42_42_42/0.18)]',
          'sm:rounded-panel sm:my-auto',
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
