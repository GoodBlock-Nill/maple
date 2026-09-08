'use client'

import { useCallback, useState } from 'react'

import { InlineUrlField } from '@/components/editor/InlineUrlField'
import { TOOLBAR_BUTTON_CLASS, ToolbarButton } from '@/components/editor/ToolbarButton'
import { useToolbarCommands } from '@/components/editor/use-toolbar-commands'

import type { Editor } from '@tiptap/react'

/**
 * 본문 에디터 툴바.
 *
 * 버튼은 전부 `<button type="button">` 이다 — 글쓰기 폼 안에 있어서 type 을 빼면
 * 굵게를 한 번 누를 때마다 글이 저장된다. 토글 상태는 `aria-pressed` 로 알린다.
 *
 * 실제 명령과 상태 구독은 `useToolbarCommands` 가 맡는다. Tiptap 3 의 `useEditor`
 * 는 기본적으로 트랜잭션마다 리렌더하지 않으므로 상태는 그쪽에서 구독해야 한다.
 */

const GROUP_CLASS = 'flex items-center gap-1'

/* 툴바는 에디터 상단에 붙어 따라온다. 관리자 화면의 Topbar 는 sticky 가 아니므로
   0 에 붙여도 가려지지 않는다. */
const TOOLBAR_CLASS = 'border-line bg-surface sticky top-0 z-10 rounded-t-card border-b'

type PromptKind = 'link' | 'video'

type EditorToolbarProps = {
  editor: Editor
  /** 파일 선택창을 여는 콜백. 파일 입력은 `PostEditor` 가 들고 있다. */
  onPickImage: () => void
  isUploading: boolean
}

/** 툴바 버튼이 에디터 포커스를 빼앗지 않게 한다(`ToolbarButton` 주석 참고). */
function keepFocus(event: { preventDefault: () => void }): void {
  event.preventDefault()
}

export function EditorToolbar({ editor, onPickImage, isUploading }: EditorToolbarProps) {
  const [prompt, setPrompt] = useState<PromptKind | null>(null)

  const closePrompt = useCallback(() => {
    setPrompt(null)
  }, [])

  const { active, run, applyLink, applyVideo } = useToolbarCommands(editor, closePrompt)

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
          <ToolbarButton
            label="밑줄"
            text="U"
            isActive={active.underline}
            onClick={() => run((chain) => chain.toggleUnderline())}
          />
          <ToolbarButton
            label="취소선"
            text="S"
            isActive={active.strike}
            onClick={() => run((chain) => chain.toggleStrike())}
          />
        </div>

        <div className={GROUP_CLASS}>
          <ToolbarButton
            label="제목"
            text="H2"
            isActive={active.heading2}
            onClick={() => run((chain) => chain.toggleHeading({ level: 2 }))}
          />
          <ToolbarButton
            label="소제목"
            text="H3"
            isActive={active.heading3}
            onClick={() => run((chain) => chain.toggleHeading({ level: 3 }))}
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
            label="인용"
            text="인용"
            isActive={active.blockquote}
            onClick={() => run((chain) => chain.toggleBlockquote())}
          />
        </div>

        <div className={GROUP_CLASS}>
          <ToolbarButton
            label="링크"
            text="링크"
            isActive={active.link || prompt === 'link'}
            onClick={() => setPrompt((current) => (current === 'link' ? null : 'link'))}
          />
          <button
            type="button"
            aria-label="이미지 첨부"
            title="이미지 첨부"
            onMouseDown={keepFocus}
            onClick={onPickImage}
            disabled={isUploading}
            className={TOOLBAR_BUTTON_CLASS}
          >
            {isUploading ? '올리는 중' : '이미지'}
          </button>
          <ToolbarButton
            label="영상 첨부"
            text="영상"
            isActive={prompt === 'video'}
            onClick={() => setPrompt((current) => (current === 'video' ? null : 'video'))}
          />
        </div>
      </div>

      {prompt === null ? null : (
        <InlineUrlField
          key={prompt}
          label={prompt === 'link' ? '링크 주소' : '영상 주소'}
          placeholder={
            prompt === 'link' ? 'https://example.com' : 'https://www.youtube.com/watch?v=...'
          }
          onSubmit={prompt === 'link' ? applyLink : applyVideo}
          onCancel={closePrompt}
        />
      )}
    </div>
  )
}
