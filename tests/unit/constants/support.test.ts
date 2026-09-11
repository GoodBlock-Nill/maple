import { describe, expect, it } from 'vitest'

import { ATTACHMENT_NOTICE_LINES } from '@/lib/constants/inquiry-attachment'
import {
  INQUIRY_CANCELLED_OPTION,
  INQUIRY_STATUS_MAP,
  INQUIRY_STATUS_VALUES,
  resolveInquiryStatus,
} from '@/lib/constants/inquiry-status'
import { INQUIRY_PAGE_SIZE, MY_INQUIRIES_PATH, SUPPORT_MENU } from '@/lib/constants/support'
import {
  INQUIRY_ATTACHMENT_MAX_MB,
  INQUIRY_ATTACHMENT_TOTAL_MAX_MB,
  INQUIRY_FILE_MAX_COUNT,
  INQUIRY_VIDEO_MAX_COUNT,
  INQUIRY_VIDEO_MAX_MB,
} from '@/lib/supabase/storage'
import { getTotalPages } from '@/lib/utils/pagination'

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

  it('should drop the pill for 답변 완료 and keep it for every other status', () => {
    /* Arrange & Act & Assert — 시안 v2: 답변 완료만 알약을 벗고 분홍 글자가 된다.
       모양 판정이 화면마다 갈리면 목록·상세가 서로 다른 상태를 그린다. */
    expect(INQUIRY_STATUS_MAP.answered.variant).toBe('text')
    expect(INQUIRY_STATUS_MAP.answered.className).toBe('text-[#e8308a]')

    for (const status of ['pending', 'in_progress', 'closed'] as const) {
      expect(INQUIRY_STATUS_MAP[status].variant).toBe('pill')
    }
  })

  it('should paint every pill with the same neutral surface', () => {
    // Arrange & Act & Assert — 시안 실측: bg #f1f1f5, 처리 중만 글자색이 다르다.
    expect(INQUIRY_STATUS_MAP.pending.className).toBe('bg-[#f1f1f5] text-[#727272]')
    expect(INQUIRY_STATUS_MAP.closed.className).toBe('bg-[#f1f1f5] text-[#727272]')
    expect(INQUIRY_STATUS_MAP.in_progress.className).toBe('bg-[#f1f1f5] text-[#625b71]')
  })

  it('should spell out full Tailwind class strings', () => {
    // Arrange & Act & Assert — v4 는 소스를 정적으로 스캔하므로 보간이 있으면 색이 사라진다.
    for (const status of DB_STATUSES) {
      expect(INQUIRY_STATUS_MAP[status].className).not.toContain('${')
    }
  })
})

describe('resolveInquiryStatus', () => {
  const CANCELLED_AT = '2026-09-08T02:00:00.000Z'

  it('should keep the enum label while the inquiry is not cancelled', () => {
    // Arrange & Act
    const labels = DB_STATUSES.map((status) => resolveInquiryStatus(status, null).label)

    // Assert
    expect(labels).toEqual(['접수 대기', '처리 중', '답변 완료', '종료'])
  })

  it('should label a cancelled inquiry 접수 취소 instead of 종료', () => {
    // Arrange & Act — 취소는 DB 에 closed 로 저장되고 cancelled_at 으로만 구분된다.
    const option = resolveInquiryStatus('closed', CANCELLED_AT)

    // Assert
    expect(option.label).toBe('접수 취소')
    expect(option).toBe(INQUIRY_CANCELLED_OPTION)
  })

  it('should let the cancellation win over any status it was cancelled from', () => {
    // Arrange & Act & Assert — 취소 직후 상태가 아직 밀려 있어도 라벨은 접수 취소다.
    expect(resolveInquiryStatus('pending', CANCELLED_AT).label).toBe('접수 취소')
    expect(resolveInquiryStatus('in_progress', CANCELLED_AT).label).toBe('접수 취소')
  })

  it('should spell out a full Tailwind class string for the cancelled badge', () => {
    // Arrange & Act & Assert — v4 는 소스를 정적으로 스캔한다.
    expect(INQUIRY_CANCELLED_OPTION.className).toBe('bg-[#f1f1f5] text-[#727272]')
    expect(INQUIRY_CANCELLED_OPTION.variant).toBe('pill')
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
  it('should draw six rows per page like the v2 mock', () => {
    // Arrange & Act & Assert — 번호 페이지네이션은 한 장(6건)만 그린다.
    expect(INQUIRY_PAGE_SIZE).toBe(6)
    expect(getTotalPages(25, INQUIRY_PAGE_SIZE)).toBe(5)
    expect(getTotalPages(6, INQUIRY_PAGE_SIZE)).toBe(1)
  })
})

describe('ATTACHMENT_NOTICE_LINES', () => {
  it('should compose the limits from the storage constants', () => {
    /* Arrange & Act & Assert — 안내와 실제 제한이 갈리면 사용자는 "된다고 적힌
       파일"을 고르고 오류를 본다. 숫자는 전부 검증 상수에서 나온다. */
    const [limits] = ATTACHMENT_NOTICE_LINES

    expect(limits).toContain(`이미지·PDF ${INQUIRY_ATTACHMENT_MAX_MB}MB/개`)
    expect(limits).toContain(`최대 ${INQUIRY_FILE_MAX_COUNT}개`)
    expect(limits).toContain(`총 ${INQUIRY_ATTACHMENT_TOTAL_MAX_MB}MB`)
    expect(limits).toContain(`영상 ${INQUIRY_VIDEO_MAX_MB}MB/개`)
    expect(limits).toContain(`최대 ${INQUIRY_VIDEO_MAX_COUNT}개`)
    expect(limits).toContain(`총 ${INQUIRY_VIDEO_MAX_MB * INQUIRY_VIDEO_MAX_COUNT}MB`)
  })

  it('should list the accepted formats on a second line', () => {
    // Arrange & Act & Assert — 확장자 목록도 검증 상수(MIME)에서 뽑는다.
    expect(ATTACHMENT_NOTICE_LINES).toHaveLength(2)
    expect(ATTACHMENT_NOTICE_LINES[1]).toBe('(PNG, JPG, GIF, WEBP, PDF · MP4, MOV, WEBM, M4V)')
  })
})
