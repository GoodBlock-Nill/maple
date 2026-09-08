'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

import { cn } from '@/lib/utils/cn'

import type { ReactNode } from 'react'

export type ToastTone = 'info' | 'success' | 'error'

type Toast = {
  id: number
  message: string
  tone: ToastTone
}

type ToastApi = {
  showToast: (message: string, tone?: ToastTone) => void
}

const AUTO_DISMISS_MS = 4000

const TONE_CLASS: Record<ToastTone, string> = {
  info: 'bg-ink text-white',
  success: 'bg-success text-white',
  error: 'bg-danger text-white',
}

const ToastContext = createContext<ToastApi | null>(null)

/**
 * 토스트 알림.
 *
 * 서버 액션이 리다이렉트 없이 끝나는 경우(초대 발송, 권한 회수 등) 결과를 알리는
 * 유일한 창구다. `aria-live="polite"` 영역을 **항상 렌더**해 둔다 — 알림이 생길 때
 * 영역 자체를 만들면 스크린 리더가 변경을 감지하지 못해 아무것도 읽지 않는다.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly Toast[]>([])
  const nextIdRef = useRef(1)

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextIdRef.current
    nextIdRef.current += 1

    setToasts((current) => [...current, { id, message, tone }])

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, AUTO_DISMISS_MS)
  }, [])

  const api = useMemo<ToastApi>(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed right-5 bottom-5 z-[60] flex flex-col items-end gap-2"
      >
        {toasts.map((toast) => (
          <p
            key={toast.id}
            className={cn(
              'rounded-panel shadow-menu pointer-events-auto max-w-[360px] px-4 py-2.5 text-[13px] font-semibold',
              TONE_CLASS[toast.tone],
            )}
          >
            {toast.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** Provider 밖에서 부르면 조용히 무시한다 — 알림 하나 때문에 화면이 죽으면 안 된다. */
export function useToast(): ToastApi {
  const context = useContext(ToastContext)

  return context ?? { showToast: () => undefined }
}
