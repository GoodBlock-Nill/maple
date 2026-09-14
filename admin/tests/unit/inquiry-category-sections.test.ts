import { describe, expect, it } from 'vitest'

import { kindMoveNotice, kindMoveOf } from '@/components/inquiry-categories/category-kind-move'
import { groupInquiryCategoriesByKind } from '@/components/inquiry-categories/category-sections'

import type { InquiryKind } from '@/lib/constants/inquiry-kind'

/**
 * 카테고리 관리 화면의 두 가지 판단 — **어떻게 나누는가**와 **언제 묻는가**.
 *
 * 둘 다 컴포넌트 밖의 순수 함수다. 화면을 렌더해서 확인하면 섹션이 사라졌을 때가
 * 아니라 조회가 비었을 때도 통과해 버린다(줄줄이 통과하는 빈 화면).
 */

function category(kind: InquiryKind, sortOrder: number, id = `${kind}-${sortOrder}`) {
  return { id, kind, sortOrder }
}

describe('groupInquiryCategoriesByKind', () => {
  it('should lay the sections out in the order the support menu uses', () => {
    // Arrange & Act
    const sections = groupInquiryCategoriesByKind([category('report', 0), category('bug', 0)])

    // Assert — 사용자 사이트의 고객지원 메뉴와 같은 순서라야 눈이 같은 자리를 찾는다.
    expect(sections.map((section) => section.kind)).toEqual(['inquiry', 'bug', 'report'])
    expect(sections.map((section) => section.label)).toEqual([
      '1:1 문의',
      '버그제보',
      '불법이용제보',
    ])
  })

  it('should put each category in its own desk', () => {
    // Arrange
    const rows = [category('inquiry', 0), category('bug', 0), category('bug', 1)]

    // Act
    const sections = groupInquiryCategoriesByKind(rows)

    // Assert
    expect(sections[0]?.categories.map((row) => row.id)).toEqual(['inquiry-0'])
    expect(sections[1]?.categories.map((row) => row.id)).toEqual(['bug-0', 'bug-1'])
  })

  it('should sort inside the section only', () => {
    /* `sort_order` 는 kind 안에서의 순서다(마이그레이션 20260914000100). 창구가 다른
       0번끼리는 겨루지 않는다. */
    const sections = groupInquiryCategoriesByKind([
      category('bug', 2, 'bug-late'),
      category('bug', 0, 'bug-first'),
      category('inquiry', 1, 'inquiry-second'),
      category('inquiry', 0, 'inquiry-first'),
    ])

    expect(sections[0]?.categories.map((row) => row.id)).toEqual([
      'inquiry-first',
      'inquiry-second',
    ])
    expect(sections[1]?.categories.map((row) => row.id)).toEqual(['bug-first', 'bug-late'])
  })

  it('should keep an empty desk on screen', () => {
    // Arrange & Act — "버그제보 카테고리가 없다"는 사실도 보여야 추가할 곳을 찾는다.
    const sections = groupInquiryCategoriesByKind([category('inquiry', 0)])

    // Assert
    expect(sections).toHaveLength(3)
    expect(sections[1]?.categories).toEqual([])
    expect(sections[2]?.categories).toEqual([])
  })

  it('should keep the given order when two rows share a sort order', () => {
    // Arrange & Act — 조회가 created_at 으로 2차 정렬해 둔 순서(= 사용자 폼의 순서)다.
    const sections = groupInquiryCategoriesByKind([
      category('inquiry', 0, 'older'),
      category('inquiry', 0, 'newer'),
    ])

    // Assert
    expect(sections[0]?.categories.map((row) => row.id)).toEqual(['older', 'newer'])
  })
})

describe('kindMoveOf', () => {
  const USED = { label: '접속·서버', kind: 'bug' as InquiryKind, usageCount: 3 }

  it('should ask before moving a category that inquiries were filed under', () => {
    // Arrange & Act
    const move = kindMoveOf(USED, 'report')

    // Assert
    expect(move).toEqual({ label: '접속·서버', before: 'bug', after: 'report', usageCount: 3 })
  })

  it('should stay quiet when the kind did not change', () => {
    // Arrange & Act & Assert
    expect(kindMoveOf(USED, 'bug')).toBeNull()
  })

  it('should stay quiet when nothing was filed under the category', () => {
    /* 접수 0건이면 옮겨 갈 과거가 없다. 모든 저장에 확인을 붙이면 운영자가 습관적으로
       누르고 확인이 뜻을 잃는다(DEVELOPER-GUIDE §7.4). */
    expect(kindMoveOf({ ...USED, usageCount: 0 }, 'report')).toBeNull()
  })

  it('should stay quiet on the create form', () => {
    // Arrange & Act & Assert — 등록에는 옮길 과거가 없다.
    expect(kindMoveOf(undefined, 'report')).toBeNull()
  })
})

describe('kindMoveNotice', () => {
  it('should say where it goes and how many inquiries follow', () => {
    // Arrange & Act
    const notice = kindMoveNotice({
      label: '접속·서버',
      before: 'bug',
      after: 'report',
      usageCount: 3,
    })

    // Assert — 건수가 빠지면 "과거 문의까지 움직인다"는 사실이 드러나지 않는다.
    expect(notice).toBe(
      '접속·서버 카테고리를 버그제보 → 불법이용제보 로 옮깁니다. 이 카테고리로 접수된 문의 3건의 종류도 함께 바뀝니다.',
    )
  })
})
