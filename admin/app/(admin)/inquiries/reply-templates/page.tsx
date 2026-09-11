import { InquiryReplyTemplateFormDialog } from '@/components/inquiry-reply-templates/InquiryReplyTemplateFormDialog'
import { InquiryReplyTemplateGroup } from '@/components/inquiry-reply-templates/InquiryReplyTemplateGroup'
import { Button, FormBanner, PageHeader } from '@/components/ui'
import { hasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require-admin'
import { LIST_LOAD_ERROR } from '@/lib/constants/messages'
import {
  getInquiryReplyTemplateCategories,
  getInquiryReplyTemplates,
} from '@/lib/data/inquiry-reply-templates'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '답변 템플릿',
}

/* 저장 직후의 화면이 곧 답변 화면의 선택지다. 캐시된 목록을 보여 주면 "고쳤는데
   그대로"라는 오해를 부른다(카테고리 화면과 같은 규칙). */
export const dynamic = 'force-dynamic'

export default async function InquiryReplyTemplatesPage() {
  const { permissions } = await requirePermission('inquiries', 'read')
  const canWrite = hasPermission(permissions, 'inquiries', 'write')
  const [{ groups, hasError }, categories] = await Promise.all([
    getInquiryReplyTemplates(),
    getInquiryReplyTemplateCategories(),
  ])

  return (
    <>
      <PageHeader
        title="답변 템플릿"
        description="1:1 문의 답변에 불러다 쓰는 상용구입니다. 공통 템플릿은 모든 문의에서, 카테고리 템플릿은 그 분류의 문의에서만 보입니다. 자리표시자({{닉네임}} 등)는 불러오는 순간 그 문의의 정보로 바뀝니다."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button href="/inquiries/categories" variant="ghost">
              문의 카테고리
            </Button>
            {canWrite && (
              <InquiryReplyTemplateFormDialog categories={categories} triggerLabel="템플릿 등록" />
            )}
          </div>
        }
      />

      {hasError && (
        <div className="mb-3">
          <FormBanner message={LIST_LOAD_ERROR} />
        </div>
      )}

      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          /* key 에 항목 id 나열을 넣어, 서버 데이터가 바뀌면 묶음이 새 순서로 다시
             마운트되게 한다(클라이언트 정렬 상태 동기화). */
          <InquiryReplyTemplateGroup
            key={`${group.categoryId ?? 'common'}:${group.templates.map((template) => template.id).join(',')}`}
            group={group}
            categories={categories}
            canWrite={canWrite}
          />
        ))}
      </div>
    </>
  )
}
