import { InquiryCategoryFormDialog } from '@/components/inquiry-categories/InquiryCategoryFormDialog'
import { InquiryCategoryList } from '@/components/inquiry-categories/InquiryCategoryList'
import { Button, FormBanner, PageHeader } from '@/components/ui'
import { hasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require-admin'
import { LIST_LOAD_ERROR } from '@/lib/constants/messages'
import { getInquiryCategories } from '@/lib/data/inquiry-categories'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '문의 카테고리',
}

/* 저장 직후의 화면이 곧 사용자 폼의 상태다. 캐시된 목록을 보여 주면 "고쳤는데 그대로"
   라는 오해를 부른다. */
export const dynamic = 'force-dynamic'

export default async function InquiryCategoriesPage() {
  const { permissions } = await requirePermission('inquiries', 'read')
  const canWrite = hasPermission(permissions, 'inquiries', 'write')
  const { rows, hasError } = await getInquiryCategories()

  return (
    <>
      <PageHeader
        title="문의 카테고리"
        description="사용자 사이트 1:1 문의 폼의 카테고리와 프리필(문의 내용 양식)입니다. ▲▼ 로 순서를 바꾸고 '순서 저장'을 눌러 확정합니다. 숨긴 카테고리는 사용자 폼에서 사라집니다."
        /* 답변 템플릿은 같은 모듈의 형제 화면이다. 카테고리를 고치러 온 운영자가
           "이 분류의 상용구도 손보자"는 순간에 여기서 바로 건너갈 수 있어야 한다. */
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button href="/inquiries/reply-templates" variant="ghost">
              답변 템플릿
            </Button>
            {canWrite && <InquiryCategoryFormDialog triggerLabel="카테고리 등록" />}
          </div>
        }
      />

      {hasError && (
        <div className="mb-3">
          <FormBanner message={LIST_LOAD_ERROR} />
        </div>
      )}

      {/* key 에 항목 id 나열을 넣어, 서버 데이터가 바뀌면 목록이 새 순서로 다시
          마운트되게 한다(클라이언트 정렬 상태 동기화). */}
      <InquiryCategoryList
        key={rows.map((row) => row.id).join(',')}
        categories={rows}
        canWrite={canWrite}
      />
    </>
  )
}
