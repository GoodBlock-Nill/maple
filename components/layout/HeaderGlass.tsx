'use client'

import type { ReactNode } from 'react'

import { useScrolled } from '@/components/layout/use-scrolled'
import { cn } from '@/lib/utils/cn'

// 이 값을 넘어 스크롤되면 헤더가 본문 위에서 읽히도록 유리를 더 불투명하게 바꾼다.
const SCROLL_THRESHOLD = 24

type HeaderGlassProps = {
  className: string
  children: ReactNode
}

/**
 * SiteHeader(서버 컴포넌트)는 헤더 마크업만 그대로 렌더링하고,
 * 스크롤 여부를 아는 이 작은 클라이언트 컴포넌트가 <header> 태그와 유리 표면 클래스를 감싼다.
 * 최상단(scrollY 0)에서는 시안과 동일한 `.glass` 만 적용되어 픽셀 차이가 없다.
 */
export function HeaderGlass({ className, children }: HeaderGlassProps) {
  const isScrolled = useScrolled(SCROLL_THRESHOLD)

  return (
    <header
      className={cn(
        'glass pointer-events-auto',
        // 배경 알파와 그림자만 전환한다. 레이아웃에 영향 없는 속성만 transition 대상으로 두어
        // 리플로우 없이 부드럽게 바뀐다.
        'transition-[background-color,box-shadow] duration-150 ease-out motion-reduce:transition-none',
        isScrolled && 'glass-scrolled',
        className,
      )}
    >
      {children}
    </header>
  )
}
