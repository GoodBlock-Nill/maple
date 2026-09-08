import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { Placeholder } from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'

import { VideoEmbedNode } from '@/components/editor/video-embed-extension'

import type { Extensions } from '@tiptap/core'

/**
 * 에디터가 만들 수 있는 마크업의 집합.
 *
 * 여기 목록은 `lib/sanitize/post-html.ts` 의 허용 목록과 짝이다. 에디터가 만들 수
 * 있는데 정제기가 지우면 운영자는 "썼는데 사라졌다"를 겪는다. 그래서 코드블록·
 * 수평선·표처럼 허용 목록에 없는 기능은 애초에 꺼 둔다.
 */
export function createPostExtensions(placeholder: string): Extensions {
  return [
    StarterKit.configure({
      /* 글 제목은 폼의 제목 필드가 맡는다. 본문에서 h1 을 허용하면 페이지에 h1 이
         둘이 되어 문서 구조가 깨진다. */
      heading: { levels: [2, 3] },
      code: false,
      codeBlock: false,
      horizontalRule: false,
      /* 링크는 정책(rel·target·프로토콜)을 명시적으로 걸어야 해서 따로 등록한다. */
      link: false,
    }),
    Link.configure({
      openOnClick: false,
      /* 붙여 넣은 주소를 자동으로 링크로 만든다. */
      autolink: true,
      protocols: ['http', 'https'],
      /* `javascript:` · `data:` 는 여기서 한 번, 정제기에서 또 한 번 막힌다. */
      isAllowedUri: (url, context) => context.defaultValidate(url) && /^https?:\/\//iu.test(url),
      HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
    }),
    Image.configure({
      /* base64 를 허용하면 본문 한 편이 수 MB 가 되어 목록 쿼리까지 느려진다.
         이미지는 반드시 스토리지에 올린 뒤 URL 로만 들어온다. */
      allowBase64: false,
    }),
    VideoEmbedNode,
    Placeholder.configure({ placeholder }),
  ]
}
