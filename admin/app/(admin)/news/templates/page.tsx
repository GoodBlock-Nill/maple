import { NewsTemplateList } from '@/components/news-templates/NewsTemplateList'
import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormField'
import { PageHeader } from '@/components/ui/PageHeader'
import { requirePermission } from '@/lib/auth/require-admin'
import { LIST_LOAD_ERROR } from '@/lib/constants/messages'
import { listNewsTemplates } from '@/lib/data/news-templates'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '카테고리 템플릿',
}

/* 저장 직후의 화면이 곧 새 글 폼이 쓰는 양식이다. 캐시된 목록을 보여 주면 "고쳤는데
   그대로"라는 오해를 부른다. */
export const dynamic = 'force-dynamic'

/**
 * 카테고리 템플릿 관리.
 *
 * 읽기 전용 관리자에게는 열지 않는다(`news:write`). 이 화면은 보는 화면이 아니라
 * 다음에 쓸 글의 양식을 정하는 편집 도구이고, 안에 편집·되돌리기 말고는 아무것도 없다.
 */
export default async function NewsTemplatesPage() {
  await requirePermission('news', 'write')
  const { rows, hasError } = await listNewsTemplates()

  return (
    <>
      <PageHeader
        title="카테고리 템플릿 관리"
        description="카테고리별 글 양식입니다. 새 글 작성 화면에서 카테고리를 고르면 제목·요약·본문이 이 양식으로 채워집니다. {{날짜}} 같은 자리는 자동으로 바뀌지 않으니 작성할 때 직접 고쳐 주세요."
        action={
          <Button href="/news" variant="secondary">
            뉴스 목록
          </Button>
        }
      />

      {hasError && (
        <div className="mb-3">
          <FormBanner message={LIST_LOAD_ERROR} />
        </div>
      )}

      <NewsTemplateList templates={rows} />
    </>
  )
}
