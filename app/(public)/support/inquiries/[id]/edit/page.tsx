import { notFound, redirect } from 'next/navigation'

import { PageShell } from '@/components/layout/PageShell'
import { InquiryForm } from '@/components/support/InquiryForm'
import { SupportBackLink } from '@/components/support/SupportBackLink'
import { SupportCard } from '@/components/support/SupportCard'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  INQUIRY_BACK_TO_DETAIL_LABEL,
  INQUIRY_EDIT_LOCKED_PARAM,
  MY_INQUIRIES_PATH,
} from '@/lib/constants/support'
import { getMyInquiry } from '@/lib/data/inquiries'
import { getInquiryCategories } from '@/lib/data/inquiry-categories'
import { canEditInquiry } from '@/lib/utils/inquiry-permissions'
import { withLegacyCategory } from '@/lib/utils/inquiry-prefill'

import type { Metadata } from 'next'

const SUPPORT_TITLE = '고객지원'

/** 본인만 보는 화면이라 검색 노출을 막는다. */
export const metadata: Metadata = {
  title: '문의 수정',
  robots: { index: false, follow: false },
}

/**
 * 접수 대기 중인 문의의 수정 화면.
 *
 * 비로그인은 로그인으로, 남의 문의는 404 로(존재 여부를 흘리지 않는다), 이미
 * 처리가 시작됐거나 취소한 문의는 상세로 돌려보내며 이유를 1회성 안내로 남긴다 —
 * 주소를 직접 친 사용자가 빈 화면 앞에서 이유를 모르는 상황을 만들지 않는다.
 * 최종 권한은 `updateInquiry` 액션과 `guard_inquiry_owner_update()` 가 강제한다.
 */
export default async function InquiryEditPage(props: PageProps<'/support/inquiries/[id]/edit'>) {
  const { id } = await props.params
  const user = await getCurrentUser()

  if (user === null) {
    redirect(`/login?next=${encodeURIComponent(`${MY_INQUIRIES_PATH}/${id}/edit`)}`)
  }

  const inquiry = await getMyInquiry(id, user.id)

  if (inquiry === null) {
    notFound()
  }

  const detailPath = `${MY_INQUIRIES_PATH}/${inquiry.id}`

  if (!canEditInquiry(inquiry)) {
    redirect(`${detailPath}?${INQUIRY_EDIT_LOCKED_PARAM}=1`)
  }

  /* 저장된 카테고리가 그 사이 비활성화됐거나 이름이 바뀌었을 수 있다. 목록에
     없으면 뒤에 붙여 셀렉트가 저장된 값을 그대로 고를 수 있게 한다. */
  const categories = withLegacyCategory(await getInquiryCategories(), inquiry.category)

  return (
    <PageShell variant="support" title={SUPPORT_TITLE}>
      <SupportCard activeHref={MY_INQUIRIES_PATH}>
        {/* 어떤 문의를 고치는 중인지 돌아갈 길로 알려 준다 — 좌 열 제목이 없어진
            시안 v2 에서 사용자가 "지금 어느 글을 고치는가"를 잃지 않게 한다. */}
        <div className="mb-4">
          <SupportBackLink href={detailPath} label={INQUIRY_BACK_TO_DETAIL_LABEL} />
        </div>

        <InquiryForm
          isAuthenticated
          categories={categories}
          inquiryId={inquiry.id}
          defaultValues={{
            accountId: inquiry.accountId ?? '',
            category: inquiry.category,
            type: inquiry.type,
            title: inquiry.title,
            content: inquiry.content,
          }}
          attachments={inquiry.attachments}
        />
      </SupportCard>
      <div className="pb-16 xl:pb-0" />
    </PageShell>
  )
}
