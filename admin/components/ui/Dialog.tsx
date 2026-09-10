'use client'

import { useCallback, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

import type { ReactNode } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

type DialogProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}

/**
 * 모달 다이얼로그.
 *
 * 직접 만드는 이유는 세 가지 요구 때문이다 — 포털(부모의 overflow/transform 에
 * 잘리지 않게), 포커스 트랩(Tab 이 뒤 화면으로 새지 않게), Escape 닫기.
 * 네이티브 `<dialog>` 는 브라우저마다 포커스 복원과 백드롭 클릭 동작이 갈려
 * 폼 다이얼로그에서 예측하기 어렵다.
 *
 * 포털은 `document.body` 로 보낸다. 서버에는 body 가 없으니 SSR 에서는 아무것도
 * 그리지 않는다. 하이드레이션 불일치가 나지 않는 이유는 `open` 이 항상 상호작용으로
 * 켜지기 때문이다 — 첫 렌더에 열려 있는 모달은 이 컴포넌트의 용법이 아니다.
 */
export function Dialog({ open, onClose, title, description, children, footer }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descriptionId = `${titleId}-description`

  const focusables = useCallback((): HTMLElement[] => {
    const panel = panelRef.current

    if (panel === null) {
      return []
    }

    return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (element) => element.offsetParent !== null || element === document.activeElement,
    )
  }, [])

  /* 열릴 때: 여는 쪽 요소를 기억하고 첫 컨트롤로 포커스를 옮긴다.
     닫힐 때: 기억해 둔 곳으로 되돌린다(키보드 사용자가 맥락을 잃지 않게). */
  useEffect(() => {
    if (!open) {
      return
    }

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const first = focusables()[0] ?? panelRef.current
    first?.focus()

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = overflow
      restoreFocusRef.current?.focus()
    }
  }, [open, focusables])

  useEffect(() => {
    if (!open) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()

        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const elements = focusables()
      const first = elements[0]
      const last = elements[elements.length - 1]

      if (first === undefined || last === undefined) {
        return
      }

      // 트랩: 양 끝에서 넘어가려 하면 반대쪽으로 감는다.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose, focusables])

  if (!open || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 백드롭. 버튼으로 두어야 마우스·키보드 모두에서 닫기가 노출된다. */}
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/40"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description === undefined ? undefined : descriptionId}
        tabIndex={-1}
        /* 화면 높이를 넘지 않게 잡고 본문만 스크롤한다. 상한이 없으면 긴 폼
           (문의 카테고리의 프리필 + 미리보기)에서 저장 버튼이 뷰포트 밖으로 밀려
           눌리지 않는다. 머리말과 버튼 줄은 늘 보이는 편이 안전하다. */
        className="rounded-card bg-surface shadow-menu relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-[440px] flex-col outline-none"
      >
        <header className="border-line flex flex-col gap-1 border-b px-5 py-4">
          <h2 id={titleId} className="text-ink text-[16px] font-bold">
            {title}
          </h2>
          {description !== undefined && (
            <p id={descriptionId} className="text-muted text-[13px]">
              {description}
            </p>
          )}
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer !== undefined && (
          <footer className="border-line flex justify-end gap-2 border-t px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}
