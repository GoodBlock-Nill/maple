'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef } from 'react'

import { useFocusTrap } from '@/components/layout/use-focus-trap'
import { CloseIcon } from '@/components/ui/icons'

import type { ReactNode } from 'react'

type GachaModalShellProps = {
  /** 닫았을 때 돌아갈 URL(`item` 파라미터를 뺀 현재 목록 주소). */
  closeHref: string
  labelledBy: string
  children: ReactNode
}

/**
 * 상세 모달의 껍데기만 담당하는 클라이언트 아일랜드.
 * 내용은 서버에서 렌더된 노드를 그대로 받으므로 데이터 페칭이 클라이언트로
 * 새지 않는다. ESC · 딤 클릭 · 닫기 버튼이 모두 URL 을 되돌린다.
 */
export function GachaModalShell({ closeHref, labelledBy, children }: GachaModalShellProps) {
  const router = useRouter()
  const panelRef = useRef<HTMLDivElement>(null)

  useFocusTrap(panelRef, true)

  const close = useCallback(() => {
    router.push(closeHref, { scroll: false })
  }, [closeHref, router])

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [close])

  return (
    <div className="fixed inset-0 z-80 flex items-start justify-center overflow-y-auto p-4">
      <button
        type="button"
        aria-label="상세 정보 닫기"
        onClick={close}
        className="absolute inset-0 -z-10 block h-full w-full cursor-default bg-black/50"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby={labelledBy}
        /* 뷰포트 세로 중앙. `items-center` 대신 auto 마진을 써야 내용이 화면보다
           길어졌을 때 위쪽이 잘리지 않는다. */
        className="rounded-panel relative my-auto w-full max-w-[1200px] bg-white p-6"
      >
        {/* 시안에는 없지만 키보드/터치 사용자를 위한 닫기 버튼.
            카드 우상단에 두고 헤더 행에 오른쪽 여백을 줘 확률과 겹치지 않게 한다. */}
        <button
          type="button"
          aria-label="닫기"
          onClick={close}
          className="text-ink-muted hover:text-ink focus-visible:outline-focus absolute top-3 right-3 z-10 inline-flex size-9 items-center justify-center rounded-full transition-colors hover:bg-[#f3f3f3]"
        >
          <CloseIcon className="size-5" />
        </button>
        {children}
      </div>
    </div>
  )
}
