import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { VideoEmbedView } from '@/components/editor/VideoEmbedView'
import { toVideoToken } from '@/lib/sanitize/video-embed'

import type { VideoEmbed } from '@/lib/sanitize/video-embed'

/**
 * 영상 임베드 노드.
 *
 * `@tiptap/extension-youtube` 를 쓰지 않는 이유: 그 확장은 본문에 `<iframe>` 을
 * 직접 남기는데, 우리 저장 형식은 자리표시자(`<div data-video="youtube:<id>">`)다
 * (`lib/sanitize/post-html.ts` 참고). 자리표시자를 쓰면 정제기의 허용 목록에
 * iframe 을 뚫어 줄 필요가 없고, Vimeo 도 같은 노드 하나로 처리된다.
 */

export const VIDEO_EMBED_NAME = 'videoEmbed'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    videoEmbed: {
      /** 커서 위치에 영상 자리표시자를 넣는다. */
      setVideoEmbed: (embed: VideoEmbed) => ReturnType
    }
  }
}

export const VideoEmbedNode = Node.create({
  name: VIDEO_EMBED_NAME,
  group: 'block',
  /* 원자 노드 — 안에 편집 가능한 내용이 없다. 토큰만 들고 있는 자리표시자다. */
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      token: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-video'),
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes.token === 'string' ? { 'data-video': attributes.token } : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-video]' }]
  },

  renderHTML({ HTMLAttributes }) {
    /* 내용 구멍(0)을 두지 않는다. 두면 `getHTML()` 이 빈 텍스트 노드를 끼워 넣어
       정제기의 자리표시자 패턴과 어긋난다. */
    return ['div', mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoEmbedView)
  },

  addCommands() {
    return {
      setVideoEmbed:
        (embed: VideoEmbed) =>
        ({ commands, state }) =>
          /* 선택 영역을 덮어쓰지 않고 그 **뒤에** 넣는다. 원자 노드를 넣고 나면 선택이
             그 노드 자체(NodeSelection)가 되는데, 그 상태에서 다음 삽입이 평범한
             insertContent 로 들어오면 방금 넣은 영상을 갈아치운다. */
          commands.insertContentAt(state.selection.to, {
            type: this.name,
            attrs: { token: toVideoToken(embed) },
          }),
    }
  },
})
