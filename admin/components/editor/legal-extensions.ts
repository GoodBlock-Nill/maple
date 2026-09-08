import Link from '@tiptap/extension-link'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TableKit } from '@tiptap/extension-table'
import StarterKit from '@tiptap/starter-kit'

import type { Extensions } from '@tiptap/core'

/**
 * 약관 에디터가 만들 수 있는 마크업의 집합.
 *
 * 뉴스 본문(`extensions.ts`)과 다른 목록을 쓴다. 약관에는 표가 본문의 절반이지만
 * 이미지·영상·인용은 한 번도 쓰이지 않는다. 여기 목록은
 * `lib/sanitize/legal-html.ts` 의 허용 태그와 짝이다 — 에디터가 만들 수 있는데
 * 정제기가 지우면 운영자는 "썼는데 사라졌다"를 겪는다.
 *
 * 제목은 h2·h3·h4 세 단계다. 원문에 `3-7 > 가.` 같은 3단 계층이 실제로 있고,
 * 시드본이 그 구조로 들어가 있어 한 단계라도 없으면 편집 중에 계층이 무너진다.
 */
export function createLegalExtensions(placeholder: string): Extensions {
  return [
    StarterKit.configure({
      /* 문서 제목은 페이지의 h1 이 맡는다. 본문에서 h1 을 허용하면 h1 이 둘이 된다. */
      heading: { levels: [2, 3, 4] },
      code: false,
      codeBlock: false,
      horizontalRule: false,
      /* 허용 목록에 없는 서식은 애초에 만들 수 없게 둔다. */
      blockquote: false,
      strike: false,
      underline: false,
      /* 링크는 정책(rel·target·프로토콜)을 명시적으로 걸어야 해서 따로 등록한다. */
      link: false,
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      protocols: ['http', 'https'],
      /* `javascript:` · `data:` 는 여기서 한 번, 정제기에서 또 한 번 막힌다. */
      isAllowedUri: (url, context) => context.defaultValidate(url) && /^https?:\/\//iu.test(url),
      HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
    }),
    /* 열 너비 조절을 끈다. 켜면 셀마다 `colwidth` 가 붙는데 정제기가 그 속성을
       버리므로, 운영자가 맞춰 놓은 너비가 저장과 동시에 사라진다. */
    TableKit.configure({ table: { resizable: false } }),
    Placeholder.configure({ placeholder }),
  ]
}
