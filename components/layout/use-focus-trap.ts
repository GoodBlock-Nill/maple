import { useEffect } from 'react'

import type { RefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), ' +
  'select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function isVisible(element: HTMLElement) {
  return element.offsetParent !== null
}

function getFocusable(panel: HTMLElement) {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isVisible)
}

/**
 * 패널이 열려 있는 동안 Tab/Shift+Tab 포커스를 패널 내부로 가둔다.
 * 열릴 때 첫 포커스 가능 요소로 이동하고, 닫히면 트리거로 포커스를 되돌린다
 * (활성화 직전 포커스 요소를 기억해 뒀다가 복원하는 방식).
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return

    const panel = ref.current
    if (!panel) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    getFocusable(panel)[0]?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      const items = getFocusable(panel)
      const first = items[0]
      const last = items[items.length - 1]

      if (!first || !last) {
        event.preventDefault()
        return
      }

      const current = document.activeElement

      if (event.shiftKey) {
        if (current === first || !panel.contains(current)) {
          event.preventDefault()
          last.focus()
        }
      } else if (current === last || !panel.contains(current)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [active, ref])
}
