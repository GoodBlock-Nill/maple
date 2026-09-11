import { notFound } from 'next/navigation'

import { NewsTemplateForm } from '@/components/news-templates/NewsTemplateForm'
import { NewsTemplatePreview } from '@/components/news-templates/NewsTemplatePreview'
import { NewsTemplateResetButton } from '@/components/news-templates/NewsTemplateResetButton'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { requirePermission } from '@/lib/auth/require-admin'
import { getNewsTemplate } from '@/lib/data/news-templates'
import { formatDateTime } from '@/lib/utils/format-date'
import { parseNewsTemplateCategory } from '@/lib/validation/news-templates'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '카테고리 템플릿 수정',
}

export const dynamic = 'force-dynamic'

export default async function NewsTemplateEditPage(props: PageProps<'/news/templates/[category]'>) {
  await requirePermission('news', 'write')
  const { category: param } = await props.params
  const category = parseNewsTemplateCategory(param)

  /* 모르는 카테고리는 404 다. 빈 폼을 열어 주면 저장할 수 없는 값을 채우게 되고
     (FK 가 막는다), 운영자는 이유를 알 수 없는 실패를 본다. */
  if (category === null) {
    notFound()
  }

  const template = await getNewsTemplate(category)

  return (
    <>
      <PageHeader
        title={`${template.label} 템플릿`}
        description={
          template.updatedAt === null
            ? '아직 저장된 적 없는 기본 템플릿입니다. 저장하면 이 카테고리의 양식이 됩니다.'
            : `최종 수정 ${formatDateTime(template.updatedAt)}`
        }
        action={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={template.isDefault ? 'neutral' : 'accent'}>
              {template.isDefault ? '기본값' : '수정됨'}
            </Badge>
            {/* 편집 폼 밖에 둔다 — 되돌리기도 서버 액션 폼이라 안에 넣으면 폼이 중첩된다. */}
            <NewsTemplateResetButton
              category={template.categoryKey}
              label={template.label}
              isDefault={template.isDefault}
            />
            <Button href="/news/templates" variant="secondary">
              템플릿 목록
            </Button>
          </span>
        }
      />

      {/* key 를 걸어 다시 마운트하지 않는다. 저장 응답에는 갱신된 서버 화면이 함께 실려
          오는데, 그때 폼이 새로 마운트되면 완료 토스트를 띄우는 이펙트가 사라진 인스턴스에
          매달려 아무 신호도 남지 않는다. 되돌리기는 값이 통째로 바뀌므로 목록으로
          이동한다(`NewsTemplateResetButton`). */}
      <NewsTemplateForm template={template} />

      <div className="mt-6" data-testid="news-template-preview">
        <NewsTemplatePreview template={template} />
      </div>
    </>
  )
}
