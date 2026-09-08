'use client'

import { NodeViewWrapper } from '@tiptap/react'

import { parseVideoToken, videoEmbedSrc, videoEmbedTitle } from '@/lib/utils/video-embed'

import type { ReactNodeViewProps } from '@tiptap/react'

/**
 * 에디터 안에서 영상 자리표시자를 실제 임베드로 보여 주는 노드 뷰.
 *
 * 저장되는 마크업은 여전히 `<div data-video="...">` 하나뿐이다(노드의
 * `renderHTML`). 이 컴포넌트는 **화면에만** 존재하므로 "쓰면서 보이는 것"과
 * "저장되는 것"을 분리할 수 있다.
 *
 * 원자(atom) 노드라 캐럿이 안으로 들어가지 못한다. 그래서 삭제 버튼을 따로 둔다 —
 * 없으면 영상 하나 지우려고 주변을 드래그해야 한다.
 */
export function VideoEmbedView({ node, deleteNode, selected }: ReactNodeViewProps) {
  const attrs: Record<string, unknown> = node.attrs
  const token = typeof attrs.token === 'string' ? attrs.token : ''
  const embed = parseVideoToken(token)

  return (
    <NodeViewWrapper
      className={
        selected
          ? 'outline-focus relative my-4 rounded-[10px] outline-2 outline-offset-2'
          : 'relative my-4'
      }
    >
      {embed === null ? (
        <p className="border-line-soft text-ink-muted rounded-[10px] border border-dashed px-4 py-6 text-center text-[15px]">
          불러올 수 없는 영상입니다.
        </p>
      ) : (
        <div className="video-embed">
          <iframe
            src={videoEmbedSrc(embed)}
            title={videoEmbedTitle(embed)}
            loading="lazy"
            allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => deleteNode()}
        contentEditable={false}
        className="border-line-soft bg-surface text-ink-muted hover:text-ink focus-visible:outline-focus absolute top-2 right-2 rounded-[8px] border px-2.5 py-1 text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        영상 삭제
      </button>
    </NodeViewWrapper>
  )
}
