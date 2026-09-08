import { Markdown } from '@/components/board/Markdown'
import { RichContent } from '@/components/board/RichContent'

import type { ContentFormat } from '@/types/domain'

/**
 * 본문 렌더 분기.
 *
 * 에디터 도입 전에 쓰인 글은 마크다운으로 남아 있다. 일괄 변환하지 않는 이유:
 * 변환은 되돌릴 수 없고, 한 번 잘못 바뀐 본문은 원본이 사라진다. 저장된 형식을
 * 그대로 존중하고 렌더러만 갈라 두면 옛 글도 쓰인 대로 계속 보인다
 * (수정 화면에 들어가는 순간에만 HTML 로 옮겨 적는다).
 */

type PostBodyProps = {
  format: ContentFormat
  body: string
  className?: string
}

export function PostBody({ format, body, className }: PostBodyProps) {
  return format === 'html' ? (
    <RichContent html={body} className={className} />
  ) : (
    <Markdown className={className}>{body}</Markdown>
  )
}
