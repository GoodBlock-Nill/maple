import { describe, expect, it } from 'vitest'

import {
  INQUIRY_PAGE_SIZE,
  INQUIRY_STATUS_MAP,
  INQUIRY_STATUS_VALUES,
  MY_INQUIRIES_PATH,
  SUPPORT_MENU,
} from '@/lib/constants/support'
import { accumulatedCount } from '@/lib/utils/pagination'

import type { InquiryStatus } from '@/types/domain'

/** DB enum(`inquiry_status`)과 화면 매핑이 갈라지면 상태 뱃지가 조용히 빈칸이 된다. */
const DB_STATUSES: readonly InquiryStatus[] = ['pending', 'in_progress', 'answered', 'closed']

describe('INQUIRY_STATUS_MAP', () => {
  it('should cover every inquiry_status enum value', () => {
    // Arrange & Act & Assert
    expect(INQUIRY_STATUS_VALUES).toEqual(DB_STATUSES)
  })

  it('should label each status in Korean', () => {
    // Arrange & Act
    const labels = DB_STATUSES.map((status) => INQUIRY_STATUS_MAP[status].label)

    // Assert
    expect(labels).toEqual(['접수 대기', '처리 중', '답변 완료', '종료'])
  })

  it('should use the blue token pair while in progress and the green pair once answered', () => {
    // Arrange & Act & Assert — 시안 색(#2e6eff/#e5efff, #00b894/#e5fff1)의 토큰 이름이다.
    expect(INQUIRY_STATUS_MAP.in_progress.className).toBe('bg-tag-blue-bg text-tag-blue')
    expect(INQUIRY_STATUS_MAP.answered.className).toBe('bg-tag-green-bg text-tag-green')
  })

  it('should keep pending neutral and closed muted', () => {
    // Arrange & Act & Assert
    expect(INQUIRY_STATUS_MAP.pending.className).toContain('bg-tray')
    expect(INQUIRY_STATUS_MAP.closed.className).toContain('text-ink-muted')
  })

  it('should spell out full Tailwind class strings', () => {
    // Arrange & Act & Assert — v4 는 소스를 정적으로 스캔하므로 보간이 있으면 색이 사라진다.
    for (const status of DB_STATUSES) {
      expect(INQUIRY_STATUS_MAP[status].className).not.toContain('${')
    }
  })
})

describe('SUPPORT_MENU', () => {
  it('should list 내 문의 내역 as the third item', () => {
    // Arrange & Act
    const item = SUPPORT_MENU[2]

    // Assert
    expect(item?.label).toBe('내 문의 내역')
    expect(item?.href).toBe(MY_INQUIRIES_PATH)
  })

  it('should give every menu item an icon and intrinsic size', () => {
    // Arrange & Act & Assert — 크기가 없으면 next/image 가 레이아웃을 잡지 못한다.
    for (const item of SUPPORT_MENU) {
      expect(item.icon).toMatch(/^\/images\/support\/.+\.svg$/)
      expect(item.width).toBeGreaterThan(0)
      expect(item.height).toBeGreaterThan(0)
    }
  })
})

describe('INQUIRY_PAGE_SIZE', () => {
  it('should accumulate ten rows per page like the other lists', () => {
    // Arrange & Act & Assert — "더보기"는 1~N 페이지를 한 번에 보여 준다.
    expect(INQUIRY_PAGE_SIZE).toBe(10)
    expect(accumulatedCount(1, INQUIRY_PAGE_SIZE, 25)).toBe(10)
    expect(accumulatedCount(2, INQUIRY_PAGE_SIZE, 25)).toBe(20)
    expect(accumulatedCount(3, INQUIRY_PAGE_SIZE, 25)).toBe(25)
  })
})
