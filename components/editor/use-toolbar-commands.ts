'use client'

import { useEditorState } from '@tiptap/react'
import { useCallback } from 'react'

import { parseVideoUrl } from '@/lib/utils/video-embed'

import type { ChainedCommands, Editor } from '@tiptap/react'

/**
 * 툴바가 쓰는 에디터 상태와 명령.
 *
 * **포커스를 먼저 되돌리는 것이 핵심이다.** 버튼을 키보드(Tab → Enter)로 누르면
 * 포커스가 버튼에 있는데, 그 상태로 Tiptap 의 `focus()` 를 태우면 두 가지가 다
 * 틀어진다.
 *
 *  - 체인 앞에 두면: 포커스 복구가 `requestAnimationFrame` 으로 미뤄져, 목록으로
 *    감싸 **바뀐 DOM** 을 기준으로 커서를 다시 계산한다 → 커서가 목록 밖으로 나간다.
 *  - 체인 뒤에 두면: `focus()` 는 `editor.state`(= 명령 실행 **전** 문서)의 위치를
 *    읽어 새 문서에 적용한다 → 역시 엉뚱한 자리로 간다.
 *
 * 그래서 명령을 실행하기 전에 `view.dom.focus()` 로 **동기적으로** 포커스를
 * 되돌린다. 이러면 체인의 `focus()` 는 "이미 포커스됨"으로 즉시 통과한다.
 */

const LINK_ERROR = 'http:// 또는 https:// 로 시작하는 주소만 넣을 수 있습니다.'
const VIDEO_ERROR = '유튜브 또는 Vimeo 영상 주소를 넣어 주세요.'

const HTTP_URL_PATTERN = /^https?:\/\/[^\s]+$/iu

export type ToolbarCommands = {
  /** 버튼별 활성 상태(`aria-pressed`). */
  active: {
    bold: boolean
    italic: boolean
    underline: boolean
    strike: boolean
    heading2: boolean
    heading3: boolean
    bulletList: boolean
    orderedList: boolean
    blockquote: boolean
    link: boolean
  }
  run: (apply: (chain: ChainedCommands) => ChainedCommands) => void
  /** 유효하지 않으면 화면에 띄울 문구를 돌려준다. 성공하면 null. */
  applyLink: (url: string) => string | null
  applyVideo: (url: string) => string | null
}

export function useToolbarCommands(editor: Editor, onDone: () => void): ToolbarCommands {
  const active = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      bold: instance.isActive('bold'),
      italic: instance.isActive('italic'),
      underline: instance.isActive('underline'),
      strike: instance.isActive('strike'),
      heading2: instance.isActive('heading', { level: 2 }),
      heading3: instance.isActive('heading', { level: 3 }),
      bulletList: instance.isActive('bulletList'),
      orderedList: instance.isActive('orderedList'),
      blockquote: instance.isActive('blockquote'),
      link: instance.isActive('link'),
    }),
  })

  const run = useCallback(
    (apply: (chain: ChainedCommands) => ChainedCommands) => {
      editor.view.dom.focus()
      apply(editor.chain().focus()).run()
    },
    [editor],
  )

  const applyLink = useCallback(
    (url: string): string | null => {
      if (!HTTP_URL_PATTERN.test(url)) {
        return LINK_ERROR
      }

      run((chain) => chain.extendMarkRange('link').setLink({ href: url }))
      onDone()

      return null
    },
    [onDone, run],
  )

  const applyVideo = useCallback(
    (url: string): string | null => {
      const embed = parseVideoUrl(url)

      if (embed === null) {
        return VIDEO_ERROR
      }

      run((chain) => chain.setVideoEmbed(embed))
      onDone()

      return null
    },
    [onDone, run],
  )

  return { active, run, applyLink, applyVideo }
}
