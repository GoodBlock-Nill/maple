import { FaqCategorySection } from '@/components/faqs/FaqCategorySection'
import { FaqFormDialog } from '@/components/faqs/FaqFormDialog'
import { PageHeader } from '@/components/ui'
import { getFaqGroups } from '@/lib/data/faqs'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAQ',
}

/* 발행 토글·정렬 저장 직후의 화면이 곧 사용자 사이트의 상태다. 캐시된 목록을
   보여 주면 "숨겼는데 그대로"라는 오해를 부른다. */
export const dynamic = 'force-dynamic'

export default async function FaqsPage() {
  const groups = await getFaqGroups()

  return (
    <>
      <PageHeader
        title="FAQ"
        description="카테고리 안에서 ▲▼ 로 순서를 바꾸고 '순서 저장'을 눌러 확정합니다. 미발행 항목은 사용자 사이트에 보이지 않습니다."
        action={<FaqFormDialog triggerLabel="FAQ 등록" />}
      />

      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          /* key 에 항목 id 나열을 넣어, 서버 데이터가 바뀌면 섹션이 새 순서로
             다시 마운트되게 한다(클라이언트 정렬 상태 동기화). */
          <FaqCategorySection
            key={`${group.category}:${group.items.map((item) => item.id).join(',')}`}
            group={group}
          />
        ))}
      </div>
    </>
  )
}
