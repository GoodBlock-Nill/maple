import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

import { sanitizePostHtml } from '@/lib/sanitize/post-html'

import type { SanitizePostHtmlOptions } from '@/lib/sanitize/post-html'

/**
 * 레거시 마크다운 본문 → 에디터가 읽을 수 있는 HTML.
 *
 * 파이프라인은 `components/board/Markdown.tsx` 와 같은 조합(remark-parse +
 * remark-gfm)이다. 다른 파서를 쓰면 "보던 화면과 고치기 시작한 화면이 다른" 상황이
 * 생긴다. 끝은 항상 `sanitizePostHtml()` 이다 — 마크다운 안에 raw HTML 을 적어 둔
 * 옛 글이 있을 수 있고, 표·코드블록처럼 허용 목록 밖 요소도 여기서 정리된다.
 *
 * `allowDangerousHtml` 은 켜지 않는다. 켜면 raw HTML 이 그대로 통과해 정제기가
 * 한 겹만 남는데, 굳이 방어선을 하나 줄일 이유가 없다.
 */
const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeStringify)

export async function markdownToPostHtml(
  markdown: string,
  options?: SanitizePostHtmlOptions,
): Promise<string> {
  const file = await processor.process(markdown)

  return sanitizePostHtml(String(file), options)
}
