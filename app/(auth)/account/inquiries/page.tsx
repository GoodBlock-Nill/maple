import { InquiryTable } from '@/components/account/InquiryTable'
import { MyPageShell } from '@/components/account/MyPageShell'
import { MYPAGE_INQUIRIES_PATH } from '@/components/account/mypage-tabs'
import { requireAccountSession, toShellUser } from '@/lib/auth/account-guard'
import { getMyInquiries } from '@/lib/data/inquiries'

import type { Metadata } from 'next'

/** 본인만 보는 화면이라 검색 노출을 막는다. */
export const metadata: Metadata = {
  title: '문의내역',
  description: '접수한 1:1 문의와 처리 상태를 확인합니다.',
  robots: { index: false, follow: false },
}

/**
 * 마이페이지 — 문의내역 탭(시안 2041:3237).
 *
 * 목록은 고객지원의 "내 문의 내역"과 같은 조회를 쓰고 상세도 그쪽(`/support/
 * inquiries/[id]`)으로 보낸다. 여기서는 첫 페이지(10건)만 표로 보여 주고, 그보다
 * 많으면 기존 화면으로 넘긴다 — 누적 "더보기"·취소 동작이 이미 거기에 있다.
 */
export default async function AccountInquiriesPage() {
  const session = await requireAccountSession(MYPAGE_INQUIRIES_PATH)
  const list = await getMyInquiries(session.userId)

  return (
    <MyPageShell activeHref={MYPAGE_INQUIRIES_PATH} user={toShellUser(session)}>
      <InquiryTable list={list} />
    </MyPageShell>
  )
}
