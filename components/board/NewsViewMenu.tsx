'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'

import { NEWS_VIEWS } from '@/lib/constants/board'
import { cn } from '@/lib/utils/cn'

import type { NewsView } from '@/types/domain'

/** 트리거 아이콘 25 · 메뉴 아이콘 24 (시안 실측). */
const TRIGGER_ICON_SIZE = 25
const MENU_ICON_SIZE = 24

/** 보기 모드 → 아이콘 자산(시안 v2 §1·§5). */
const VIEW_ICON_SRC: Record<NewsView, string> = {
  card: '/images/news/v2/view-card.svg',
  list: '/images/news/v2/view-list.svg',
}

/**
 * 트리거 — 흰 상자(`board-control` = h45 · radius 10 · border #cdd3db · 3단 그림자).
 * 라벨 길이에 따라 폭이 달라진다(시안 실측: 카드형 104×45, 리스트형 120×45) — 고정 폭 대신
 * 내용에 맡긴다.
 */
const TRIGGER_CLASS =
  'board-control text-ink focus-visible:outline-focus flex w-[45px] shrink-0 items-center ' +
  'justify-center gap-2 text-ui font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'sm:w-auto sm:px-3'

/** 드롭다운 상자 — white · radius 10 · padding 4 · shadow 0 10 15 -3 / 0 4 6 -4. */
const PANEL_CLASS =
  'shadow-menu absolute top-[calc(100%+8px)] right-0 z-30 w-max min-w-[104px] rounded-[10px] bg-white p-1'

/** 항목 — h40 · px12 py8 · radius 8 · 아이콘 24 + gap 8 + 17 medium. */
const ITEM_CLASS =
  'text-ink focus-visible:outline-focus flex h-10 items-center gap-2 rounded-lg px-3 py-2 ' +
  'text-ui font-medium whitespace-nowrap focus-visible:-outline-offset-2 focus-visible:outline-2'

/** 선택된 항목 배경(시안 실측 #dbdbdb). 토큰에 같은 회색이 없어 값으로 둔다. */
const ITEM_SELECTED_CLASS = 'bg-[#dbdbdb]'

type ViewIconProps = {
  view: NewsView
  size: number
}

function ViewIcon({ view, size }: ViewIconProps) {
  return <Image src={VIEW_ICON_SRC[view]} alt="" width={size} height={size} aria-hidden />
}

type NewsViewMenuProps = {
  current: NewsView
  /**
   * 보기 값 → 이동할 URL. 나머지 질의 문자열 유지는 호출부(페이지) 책임이다.
   * 함수가 아니라 **미리 계산한 표**로 받는다 — 서버 컴포넌트인 페이지는 함수를
   * 클라이언트 컴포넌트로 넘길 수 없다(`SortMenu` → `LinkMenu` 와 같은 구조).
   */
  hrefs: Record<NewsView, string>
  className?: string
}

/**
 * 뉴스 목록 보기 전환(시안 v2 §1). 트리거 라벨은 **현재 보기 이름**이고, 항목은
 * 전부 `<Link>` 다 — 보기 모드가 URL 에만 있으므로 서버가 그린 목록과 상태가
 * 어긋날 수 없고 우클릭 새 탭·프리페치도 그대로 산다.
 *
 * 접근성(`AccountMenu` 와 같은 규약): Escape 로 닫고 트리거로 포커스를 되돌리며,
 * 열면 첫 항목으로 이동하고 바깥을 누르면 닫힌다.
 */
export function NewsViewMenu({ current, hrefs, className }: NewsViewMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const firstItemRef = useRef<HTMLAnchorElement>(null)
  const currentOption = NEWS_VIEWS.find((option) => option.value === current)

  useEffect(() => {
    if (!isOpen) return

    firstItemRef.current?.focus()

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return

      setIsOpen(false)
      triggerRef.current?.focus()
    }

    /* pointerdown 으로 듣는다 — click 까지 기다리면 바깥 요소의 클릭이 먼저 먹혀
       "한 번 더 눌러야 닫히는" 것처럼 보인다. */
    const handlePointerDown = (event: globalThis.PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node) === true) return

      setIsOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label={`목록 보기 방식: ${currentOption?.label ?? ''}`}
        onClick={() => setIsOpen(!isOpen)}
        className={TRIGGER_CLASS}
      >
        <ViewIcon view={current} size={TRIGGER_ICON_SIZE} />
        {/* 폰에서는 아이콘만 남긴다 — 검색창이 한 줄을 거의 다 쓴다(시안 v2 §3). */}
        <span className="hidden sm:inline">{currentOption?.label}</span>
      </button>

      {isOpen ? (
        <div id={menuId} role="menu" aria-label="목록 보기 방식" className={PANEL_CLASS}>
          {NEWS_VIEWS.map((option, index) => (
            <Link
              key={option.value}
              ref={index === 0 ? firstItemRef : undefined}
              href={hrefs[option.value]}
              role="menuitemradio"
              aria-checked={option.value === current}
              onClick={() => setIsOpen(false)}
              className={cn(
                ITEM_CLASS,
                option.value === current ? ITEM_SELECTED_CLASS : 'hover:bg-sheet',
              )}
            >
              <ViewIcon view={option.value} size={MENU_ICON_SIZE} />
              {option.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}
