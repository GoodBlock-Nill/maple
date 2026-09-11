import { NewsForm } from '@/components/news/NewsForm'
import { PageHeader } from '@/components/ui/PageHeader'
import { requirePermission } from '@/lib/auth/require-admin'
import { listNewsCategories } from '@/lib/data/news'
import { listNewsTemplateOptions } from '@/lib/data/news-templates'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '새 뉴스 작성',
}

/* 카테고리 목록과 템플릿을 매번 읽는다. 정적으로 굳으면 카테고리를 추가하거나 템플릿을
   고쳐도 폼에 나타나지 않는다. */
export const dynamic = 'force-dynamic'

export default async function NewNewsPage() {
  await requirePermission('news', 'write')
  const [categories, templates] = await Promise.all([
    listNewsCategories(),
    listNewsTemplateOptions(),
  ])

  return (
    <>
      <PageHeader
        title="새 뉴스 작성"
        description="카테고리를 고르면 그 카테고리의 템플릿이 제목·본문을 채웁니다. 임시저장으로 두었다가 나중에 발행하거나, 시각을 지정해 예약 발행할 수 있습니다."
      />

      <NewsForm categories={categories} templates={templates} post={null} />
    </>
  )
}
