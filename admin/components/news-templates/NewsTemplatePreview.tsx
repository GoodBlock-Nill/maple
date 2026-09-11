import { PREVIEW_PROSE_CLASS } from '@/components/editor/typography'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { renderPostHtml } from '@/lib/sanitize/render-post-html'

import type { AdminNewsTemplate } from '@/lib/data/news-templates'

/**
 * 저장된 템플릿을 **사용자 사이트가 그리는 서식 그대로** 보여 주는 미리보기.
 *
 * 뉴스 상세의 미리보기(`components/news/NewsPreview.tsx`)와 같은 타이포그래피를 쓴다 —
 * 템플릿은 결국 글이 되므로, 여기서 보이는 모양과 발행된 글의 모양이 달라서는 안 된다.
 *
 * `dangerouslySetInnerHTML` 은 의도된 선택이다. 여기 오는 문자열은 저장 직전에
 * `sanitizePostHtml()` 을 통과한 값(또는 같은 규칙으로 만든 코드 시드)뿐이다.
 *
 * **편집 중인 내용은 반영되지 않는다.** 저장된 값을 그린다 — 에디터의 임시 상태까지
 * 따라 그리면 "미리보기에는 있는데 저장된 적 없는" 문안이 생긴다.
 */
export function NewsTemplatePreview({ template }: { template: AdminNewsTemplate }) {
  return (
    <Card>
      <CardHeader
        title="템플릿 미리보기"
        description="저장된 템플릿을 사용자 사이트와 같은 서식으로 그립니다. 편집 중인 내용은 저장해야 반영됩니다."
      />

      <CardBody className="mx-auto w-full max-w-[860px] py-8">
        <p className="text-ink text-[22px] leading-snug font-bold">
          {template.title === '' ? '(제목 템플릿 없음)' : template.title}
        </p>

        {template.summary !== '' && (
          <p className="text-muted mt-2 text-[14px]">{template.summary}</p>
        )}

        {template.body === '' ? (
          <p className="text-muted mt-6 text-[13px]">본문 템플릿이 비어 있습니다.</p>
        ) : (
          <div
            className={`mt-6 ${PREVIEW_PROSE_CLASS}`}
            dangerouslySetInnerHTML={{ __html: renderPostHtml(template.body) }}
          />
        )}
      </CardBody>
    </Card>
  )
}
