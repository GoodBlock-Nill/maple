'use client'

import { useEffect, useState } from 'react'

/**
 * `window.scrollY` 가 threshold 를 넘었는지 여부를 rAF 로 스로틀링해 반환한다.
 * 새로고침으로 문서 중간에서 시작하는 경우를 놓치지 않도록 마운트 시 한 번 더 읽는다.
 */
export function useScrolled(threshold: number) {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    let frame: number | null = null

    const measure = () => {
      frame = null
      setIsScrolled(window.scrollY > threshold)
    }

    const handleScroll = () => {
      // 스크롤 이벤트가 프레임보다 훨씬 자주 발생하므로, 이미 예약된 프레임이 있으면 건너뛴다.
      if (frame !== null) return
      frame = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [threshold])

  return isScrolled
}
