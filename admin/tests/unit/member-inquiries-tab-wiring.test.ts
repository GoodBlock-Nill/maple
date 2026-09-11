import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * 회원 상세 "1:1 문의" 탭 배선.
 *
 * 렌더 테스트는 탭이 사라졌을 때가 아니라 **권한 검사가 빠졌을 때** 통과해
 * 버린다(줄줄이 통과하는 빈 화면). 소스를 읽어 확인하는 이유는
 * `members-no-role-actions.test.ts` 와 같다 — 파일이 무엇을 하는지가 계약이다.
 */

const adminRoot = path.join(__dirname, '..', '..')

function read(relative: string): string {
  return readFileSync(path.join(adminRoot, relative), 'utf8')
}

describe('회원 상세 — 1:1 문의 탭', () => {
  it('members:read 와 별개로 inquiries:read 를 확인한다', () => {
    const source = read('app/(admin)/members/[id]/page.tsx')

    expect(source).toContain(
      "const canReadInquiries = hasPermission(actor.permissions, 'inquiries', 'read')",
    )
  })

  it('권한이 없으면 문의 조회 자체를 건너뛴다', () => {
    const source = read('app/(admin)/members/[id]/page.tsx')

    expect(source).toContain("if (tab !== 'inquiries' || !canRead)")
    expect(source).toContain('loadMemberInquiries(tab, id, canReadInquiries)')
  })

  it('지표 카드 수치와 같은 값(activity.inquiryCount)을 탭 건수로 쓴다', () => {
    const source = read('app/(admin)/members/[id]/page.tsx')

    expect(source).toContain('inquiries: activity.inquiryCount')
    expect(source).toContain(
      'activity.inquiryCount > memberInquiries.rows.length ? `/inquiries?user=${id}` : null',
    )
  })

  it('탭 목록에 문의를 포함하고 게시글·댓글·신고와 같은 URL(`?tab=`) 규약을 쓴다', () => {
    const source = read('components/members/MemberActivityPanel.tsx')

    expect(source).toContain("'inquiries',")
    expect(source).toContain("inquiries: '1:1 문의'")
    expect(source).toContain('<MemberInquiriesTab')
  })

  it('권한이 없으면 표보다 먼저 한 줄 안내로 돌아간다(early return)', () => {
    const source = read('components/members/MemberInquiriesTab.tsx')

    const guardIndex = source.indexOf('if (!canRead)')
    const noticeIndex = source.indexOf('문의 조회 권한이 없습니다.')
    const tableIndex = source.indexOf('<Table')

    expect(guardIndex).toBeGreaterThan(-1)
    expect(noticeIndex).toBeGreaterThan(guardIndex)
    expect(tableIndex).toBeGreaterThan(noticeIndex)
  })

  it('제목은 문의 상세(`/inquiries/[id]`)로 링크한다', () => {
    expect(read('components/members/MemberInquiriesTab.tsx')).toContain(
      'href={`/inquiries/${row.id}`}',
    )
  })
})
