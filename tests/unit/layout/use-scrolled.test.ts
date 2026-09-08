import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useScrolled } from '@/components/layout/use-scrolled'

const THRESHOLD = 24

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', { value, writable: true, configurable: true })
}

describe('useScrolled', () => {
  beforeEach(() => {
    setScrollY(0)
    // jsdom 의 requestAnimationFrame 은 비동기 타이머라 테스트가 불안정해지므로
    // 동기적으로 콜백을 실행하는 스텁으로 대체한다.
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should return false when scrollY is at the threshold on mount', () => {
    // Arrange
    setScrollY(THRESHOLD)

    // Act
    const { result } = renderHook(() => useScrolled(THRESHOLD))

    // Assert
    expect(result.current).toBe(false)
  })

  it('should return true on mount when reloading mid-scroll past the threshold', () => {
    // Arrange
    setScrollY(100)

    // Act
    const { result } = renderHook(() => useScrolled(THRESHOLD))

    // Assert
    expect(result.current).toBe(true)
  })

  it('should update to true when a scroll event pushes scrollY past the threshold', () => {
    // Arrange
    const { result } = renderHook(() => useScrolled(THRESHOLD))
    expect(result.current).toBe(false)

    // Act
    act(() => {
      setScrollY(50)
      window.dispatchEvent(new Event('scroll'))
    })

    // Assert
    expect(result.current).toBe(true)
  })

  it('should update back to false when scrolling back to the top', () => {
    // Arrange
    setScrollY(100)
    const { result } = renderHook(() => useScrolled(THRESHOLD))
    expect(result.current).toBe(true)

    // Act
    act(() => {
      setScrollY(0)
      window.dispatchEvent(new Event('scroll'))
    })

    // Assert
    expect(result.current).toBe(false)
  })

  it('should remove the scroll listener on unmount', () => {
    // Arrange
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useScrolled(THRESHOLD))

    // Act
    unmount()

    // Assert
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function))
    removeSpy.mockRestore()
  })
})
