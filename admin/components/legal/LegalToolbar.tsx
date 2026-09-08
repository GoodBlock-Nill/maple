'use client'

import { useEditorState } from '@tiptap/react'
import { useCallback, useState } from 'react'

import { InlineUrlField } from '@/components/editor/InlineUrlField'
import { ToolbarButton } from '@/components/editor/ToolbarButton'

import type { ChainedCommands, Editor } from '@tiptap/react'

/**
 * 약관 에디터 툴바.
 *
 * 뉴스 툴바(`EditorToolbar`)와 버튼 구성이 다르다 — 이미지·영상·인용·취소선이
 * 없고, 대신 제목 3단계와 표 조작이 있다. 두 화면이 한 컴포넌트를 공유하면
 * "이 문서에서는 쓸 수 없는 버튼"을 조건부로 숨기는 분기가 계속 늘어난다.
 *
 * 버튼은 전부 `type="button"` 이다(`ToolbarButton` 주석 참고). 명령 실행 전에
 * `view.dom.focus()` 로 포커스를 **동기적으로** 되돌리는 이유도 같은 파일에 있다.
 */

const GROUP_CLASS = 'flex items-center gap-1'
const TOOLBAR_CLASS = 'border-line bg-surface sticky top-0 z-10 rounded-t-card border-b'
const LINK_ERROR = 'http:// 또는 https:// 로 시작하는 주소만 넣을 수 있습니다.'
const HTTP_URL_PATTERN = /^https?:\/\/[^\s]+$/iu

type LegalToolbarProps = {
  editor: Editor
}

export function LegalToolbar({ editor }: LegalToolbarProps) {
  const [isLinkOpen, setLinkOpen] = useState(false)

  const active = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      bold: instance.isActive('bold'),
      italic: instance.isActive('italic'),
      heading2: instance.isActive('heading', { level: 2 }),
      heading3: instance.isActive('heading', { level: 3 }),
      heading4: instance.isActive('heading', { level: 4 }),
      bulletList: instance.isActive('bulletList'),
      orderedList: instance.isActive('orderedList'),
      link: instance.isActive('link'),
      table: instance.isActive('table'),
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
      setLinkOpen(false)

      return null
    },
    [run],
  )

  return (
    <div className={TOOLBAR_CLASS}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
        <div className={GROUP_CLASS}>
          <ToolbarButton
            label="굵게"
            text="B"
            isActive={active.bold}
            onClick={() => run((chain) => chain.toggleBold())}
          />
          <ToolbarButton
            label="기울임"
            text="I"
            isActive={active.italic}
            onClick={() => run((chain) => chain.toggleItalic())}
          />
        </div>

        <div className={GROUP_CLASS}>
          <ToolbarButton
            label="장 제목"
            text="H2"
            isActive={active.heading2}
            onClick={() => run((chain) => chain.toggleHeading({ level: 2 }))}
          />
          <ToolbarButton
            label="절 제목"
            text="H3"
            isActive={active.heading3}
            onClick={() => run((chain) => chain.toggleHeading({ level: 3 }))}
          />
          <ToolbarButton
            label="항 제목"
            text="H4"
            isActive={active.heading4}
            onClick={() => run((chain) => chain.toggleHeading({ level: 4 }))}
          />
        </div>

        <div className={GROUP_CLASS}>
          <ToolbarButton
            label="글머리 기호 목록"
            text="목록"
            isActive={active.bulletList}
            onClick={() => run((chain) => chain.toggleBulletList())}
          />
          <ToolbarButton
            label="번호 매기기 목록"
            text="번호"
            isActive={active.orderedList}
            onClick={() => run((chain) => chain.toggleOrderedList())}
          />
          <ToolbarButton
            label="링크"
            text="링크"
            isActive={active.link || isLinkOpen}
            onClick={() => setLinkOpen((current) => !current)}
          />
        </div>

        <div className={GROUP_CLASS}>
          <ToolbarButton
            label="표 넣기"
            text="표"
            onClick={() =>
              run((chain) => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }))
            }
          />
          <ToolbarButton
            label="행 추가"
            text="+행"
            onClick={() => run((chain) => chain.addRowAfter())}
          />
          <ToolbarButton
            label="열 추가"
            text="+열"
            onClick={() => run((chain) => chain.addColumnAfter())}
          />
          <ToolbarButton
            label="행 삭제"
            text="−행"
            onClick={() => run((chain) => chain.deleteRow())}
          />
          <ToolbarButton
            label="열 삭제"
            text="−열"
            onClick={() => run((chain) => chain.deleteColumn())}
          />
          <ToolbarButton
            label="표 삭제"
            text="표 삭제"
            isActive={active.table}
            onClick={() => run((chain) => chain.deleteTable())}
          />
        </div>
      </div>

      {isLinkOpen ? (
        <InlineUrlField
          label="링크 주소"
          placeholder="https://example.com"
          onSubmit={applyLink}
          onCancel={() => setLinkOpen(false)}
        />
      ) : null}
    </div>
  )
}
