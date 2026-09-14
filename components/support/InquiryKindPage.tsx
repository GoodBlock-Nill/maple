import { PageShell } from '@/components/layout/PageShell'
import { InquiryForm } from '@/components/support/InquiryForm'
import { SupportCard } from '@/components/support/SupportCard'
import { getCurrentUser } from '@/lib/auth/current-user'
import { INQUIRY_KIND_MAP } from '@/lib/constants/inquiry-kind'
import { getInquiryCategories } from '@/lib/data/inquiry-categories'

import type { InquiryKind } from '@/types/domain'

const SUPPORT_TITLE = '고객지원'

type InquiryKindPageProps = {
  kind: InquiryKind
}

/**
 * 접수 화면 본문 — 세 창구가 공유한다.
 *
 * `/support`(1:1 문의) · `/support/bug` · `/support/report` 는 **창구 하나만** 다르고
 * 폼·첨부·동의·잠금 규칙이 모두 같다. 라우트마다 같은 화면을 다시 쓰면 필수 항목이
 * 하나 늘 때 세 곳을 고쳐야 하고, 그중 하나를 잊으면 창구별로 다른 폼이 남는다.
 *
 * 라우트 파일이 하는 일은 둘뿐이다 — 메타데이터와 이 컴포넌트에 넘길 kind.
 */
export async function InquiryKindPage({ kind }: InquiryKindPageProps) {
  /* 카테고리는 누가 보든 같은 공개 문구라 캐시에서 읽는다(태그 `inquiry-categories`).
     로그인 판정과 서로 기다릴 이유가 없어 함께 던진다. */
  const [user, categories] = await Promise.all([getCurrentUser(), getInquiryCategories(kind)])

  return (
    <PageShell variant="support" title={SUPPORT_TITLE}>
      <SupportCard activeHref={INQUIRY_KIND_MAP[kind].path}>
        {/* 계정 ID 는 필수 항목이다. 프로필에 월드 UID 가 연동돼 있으면 미리 채워
            사용자가 클라이언트를 켜서 옮겨 적는 일을 줄인다(수정 가능). */}
        <InquiryForm
          kind={kind}
          isAuthenticated={user !== null}
          categories={categories}
          defaultAccountId={user?.mswUid ?? ''}
        />
      </SupportCard>
      <div className="pb-16 xl:pb-0" />
    </PageShell>
  )
}
