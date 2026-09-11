import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { postHtmlText } from '@/lib/sanitize/render-post-html'
import { formatDateTime } from '@/lib/utils/format-date'

import type { AdminNewsTemplate } from '@/lib/data/news-templates'

/**
 * 카테고리별 템플릿 목록 — 한 줄에 카테고리 하나.
 *
 * 한 줄이 답해야 하는 질문은 셋이다. **켜져 있는가**(꺼져 있으면 새 글 폼이 아무것도
 * 채우지 않는다), **어떤 제목으로 시작하는가**, **본문이 어떤 내용인가**. 본문은 HTML 이라
 * 그대로 보여 줄 수 없으므로 평문으로 눌러 한 줄만 보여 준다 — 서식까지 확인하려면
 * 수정 화면의 미리보기를 본다.
 */

/** 본문 HTML → 목록 한 줄. 태그를 벗기고 공백을 접어 카드 높이를 흔들지 않는다. */
function bodySnippet(body: string): string {
  const text = postHtmlText(body)

  return text === '' ? '본문 템플릿 없음' : text
}

export function NewsTemplateList({ templates }: { templates: readonly AdminNewsTemplate[] }) {
  return (
    <Card>
      <CardHeader
        title={`카테고리 템플릿 (${templates.length})`}
        description="새 글 작성 화면에서 카테고리를 고르면 이 양식이 제목·요약·본문을 채웁니다."
      />

      <ul>
        {templates.map((template) => (
          <li
            key={template.categoryKey}
            className="border-line flex flex-wrap items-center gap-3 border-b px-5 py-3 last:border-b-0"
            data-testid={`news-template-${template.categoryKey}`}
          >
            {/* 카테고리 이름의 길이가 제각각이라(공지사항 · 업데이트 안내) 폭을 고정한다.
                그러지 않으면 줄마다 제목이 시작하는 자리가 달라져 목록이 들쭉날쭉해진다. */}
            <span className="w-[92px] shrink-0">
              <Badge tone={template.tone}>{template.label}</Badge>
            </span>

            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-ink line-clamp-1 text-[14px] font-semibold">
                {template.title === '' ? '제목 템플릿 없음' : template.title}
              </span>
              <span className="text-muted line-clamp-1 text-[12px]">
                {bodySnippet(template.body)}
              </span>
              <span className="text-muted text-[12px]">
                {template.isDefault ? '기본값' : '수정됨'}
                {template.updatedAt === null
                  ? ' · 저장된 적 없음'
                  : ` · 최종 수정 ${formatDateTime(template.updatedAt)}`}
              </span>
            </span>

            {template.isActive ? (
              <Badge tone="success">사용</Badge>
            ) : (
              <Badge tone="neutral">사용 안 함</Badge>
            )}

            <Button href={`/news/templates/${template.categoryKey}`} variant="secondary" size="sm">
              수정
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
