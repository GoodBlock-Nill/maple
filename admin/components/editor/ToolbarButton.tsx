'use client'

import { cn } from '@/lib/utils/cn'

/**
 * 툴바의 서식 토글 버튼.
 *
 * `type="button"` 이 핵심이다. 글쓰기 폼 안에 있어서 기본값(submit)이면 굵게를
 * 한 번 누를 때마다 글이 저장된다. 현재 상태는 색이 아니라 `aria-pressed` 로도
 * 전달해야 스크린 리더 사용자가 "지금 굵게가 켜져 있다"를 알 수 있다.
 *
 * `mousedown` 을 막는 이유(중요): 막지 않으면 버튼이 포커스를 가져가 에디터가
 * blur 된다. 그 상태에서 목록·인용처럼 **문서 구조를 바꾸는** 명령을 실행하면,
 * 뒤이어 복구되는 포커스가 바뀐 DOM 을 기준으로 커서를 다시 계산해 커서가 방금
 * 만든 목록 **밖으로** 튀어나간다(= 이어서 친 글자가 목록에 안 들어간다).
 */

export const TOOLBAR_BUTTON_CLASS =
  'text-muted hover:bg-page hover:text-ink focus-visible:outline-focus rounded-panel inline-flex h-8 min-w-8 items-center justify-center px-2 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-40'

const ACTIVE_CLASS = 'bg-ink hover:bg-ink text-white'

type ToolbarButtonProps = {
  /** 스크린 리더·툴팁에 쓰는 전체 이름. 화면 글자(`text`)는 축약형이다. */
  label: string
  text: string
  isActive?: boolean
  onClick: () => void
}

export function ToolbarButton({ label, text, isActive = false, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isActive}
      title={label}
      onMouseDown={(event) => {
        event.preventDefault()
      }}
      onClick={onClick}
      className={cn(TOOLBAR_BUTTON_CLASS, isActive && ACTIVE_CLASS)}
    >
      {text}
    </button>
  )
}
