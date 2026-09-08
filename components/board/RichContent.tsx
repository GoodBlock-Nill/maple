import { cn } from '@/lib/utils/cn'
import { renderPostHtml } from '@/lib/utils/post-html'

/**
 * HTML 본문(`content_format = 'html'`) 렌더러.
 *
 * `dangerouslySetInnerHTML` 을 쓰는 것은 의도된 선택이다. 이 자리에 오는 문자열은
 * 저장 직전에 `sanitizePostHtml()` 을 통과한 값뿐이고, `renderPostHtml()` 이
 * 영상 자리표시자를 우리가 만든 iframe 마크업으로 바꾼다. 즉 화면에 닿는 태그는
 * 전부 우리 허용 목록 안에 있다.
 *
 * 파싱해서 React 엘리먼트로 조립하지 않는 이유: 문단 사이 간격(`.prose-board > * + *`)
 * 은 **직계 자식**에만 걸린다. 조각마다 래퍼를 넣는 순간 그 규칙이 끊겨 상세 화면의
 * 타이포그래피가 마크다운 글과 달라진다.
 */

type RichContentProps = {
  /** 정제를 마친 본문 HTML. */
  html: string
  className?: string
}

export function RichContent({ html, className }: RichContentProps) {
  return (
    <div
      className={cn('prose-board', className)}
      dangerouslySetInnerHTML={{ __html: renderPostHtml(html) }}
    />
  )
}
