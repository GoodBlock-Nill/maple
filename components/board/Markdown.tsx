import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'

import { cn } from '@/lib/utils/cn'

type MarkdownProps = {
  children: string
  className?: string
}

/**
 * 게시글 본문 렌더러.
 * 본문은 사용자 입력이 될 수 있으므로 `rehype-sanitize` 를 반드시 통과시킨다.
 * 타이포그래피는 globals.css 의 `.prose-board` 가 담당한다.
 */
export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={cn('prose-board', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
