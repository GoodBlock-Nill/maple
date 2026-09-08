'use client'

import { EditorContent, useEditor } from '@tiptap/react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { EditorToolbar } from '@/components/editor/EditorToolbar'
import { createPostExtensions } from '@/components/editor/extensions'
import { useImageUpload } from '@/components/editor/use-image-upload'
import { POST_IMAGE_MIME_EXTENSIONS } from '@/lib/supabase/storage'

import type { Editor } from '@tiptap/react'

/**
 * 커뮤니티 본문 에디터.
 *
 * 서버 액션 폼과 붙이기 위해 **숨은 input** 하나로 값을 내보낸다. 에디터를
 * `useActionState` 로 감싼 컨트롤드 컴포넌트로 만들지 않은 이유: 그러면 타이핑
 * 한 글자마다 상위 폼이 리렌더되고, ProseMirror 가 매번 새 문서를 받아 IME(한글)
 * 조합이 끊긴다.
 *
 * `immediatelyRender: false` 는 Next 의 서버 렌더에서 필수다. 켜 두면 서버에서
 * ProseMirror 가 DOM 을 만들려다 하이드레이션 불일치가 난다.
 */

const PLACEHOLDER = '내용을 입력해주세요'
const ACCEPT = Object.keys(POST_IMAGE_MIME_EXTENSIONS).join(',')

/**
 * `overflow-hidden` 을 쓰지 않는다. 넣는 순간 이 요소가 스크롤 컨테이너가 되어
 * 툴바의 `position: sticky` 가 통째로 무력화된다(툴바가 그냥 위로 밀려 사라진다).
 * 모서리는 툴바 자신이 `rounded-t-[12px]` 로 맞춘다.
 */
const SURFACE_CLASS = 'rounded-[12px] border border-line-soft bg-surface'

/** ProseMirror 루트에 직접 붙는 클래스. 본문 타이포는 상세 화면과 같은 `prose-board` 다. */
const CONTENT_CLASS = 'prose-board min-h-[320px] px-4 py-4 focus:outline-none sm:px-6'

type PostEditorProps = {
  /** 폼 필드 이름. 서버 액션이 이 이름으로 본문을 읽는다. */
  name: string
  label: string
  /** 수정 모드의 기존 본문(HTML). */
  defaultValue?: string
  hint?: string
  error?: string
}

/** 이미지 파일만 골라낸다. 텍스트 붙여넣기는 그대로 ProseMirror 가 처리하게 둔다. */
function imageFilesOf(transfer: DataTransfer | null): File[] {
  if (transfer === null) {
    return []
  }

  return Array.from(transfer.files).filter((file) => file.type.startsWith('image/'))
}

export function PostEditor({ name, label, defaultValue = '', hint, error }: PostEditorProps) {
  const hintId = useId()
  const errorId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const [content, setContent] = useState(defaultValue)

  const insertImage = useCallback((url: string) => {
    const instance = editorRef.current

    if (instance === null) {
      return
    }

    /* `setImage()` 는 현재 선택을 덮어쓴다. 직전에 넣은 이미지·영상이 선택된
       상태(NodeSelection)면 그것을 갈아치우므로, 항상 선택 **뒤**에 넣는다. */
    instance
      .chain()
      .focus()
      .insertContentAt(instance.state.selection.to, { type: 'image', attrs: { src: url } })
      .run()
  }, [])

  const { isUploading, error: uploadError, upload } = useImageUpload(insertImage)

  const editor = useEditor({
    extensions: createPostExtensions(PLACEHOLDER),
    content: defaultValue,
    immediatelyRender: false,
    editorProps: {
      /* ProseMirror 루트에 직접 붙는다. EditorContent 래퍼에 붙이면 실제 입력
         요소(role=textbox)에는 이름이 없어 보조기술이 "편집 영역"으로만 읽는다. */
      attributes: {
        class: CONTENT_CLASS,
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
      },
      handlePaste: (_view, event) => {
        const files = imageFilesOf(event.clipboardData)

        if (files.length === 0) {
          return false
        }

        event.preventDefault()
        void upload(files)

        return true
      },
      handleDrop: (_view, event, _slice, moved) => {
        // moved === true 는 문서 안에서 노드를 옮기는 중이다. 가로채면 이동이 깨진다.
        const files = moved ? [] : imageFilesOf(event.dataTransfer)

        if (files.length === 0) {
          return false
        }

        event.preventDefault()
        void upload(files)

        return true
      },
    },
    onUpdate: ({ editor: instance }) => {
      /* 빈 문서도 `<p></p>` 를 내놓는다. 그대로 보내면 검증이 "내용 있음"으로 읽으므로
         빈 상태는 빈 문자열로 눌러서 내보낸다. */
      setContent(instance.isEmpty ? '' : instance.getHTML())
    },
  })

  useEffect(() => {
    /* 렌더 중에 ref 를 건드리지 않는다. 이미지 삽입 콜백은 커밋 이후에만 불린다. */
    editorRef.current = editor
  }, [editor])

  const describedBy = [hint === undefined ? null : hintId, error === undefined ? null : errorId]
    .filter((id) => id !== null)
    .join(' ')

  return (
    <div className="flex flex-col gap-2">
      <span className="text-ink text-ui font-semibold">{label}</span>

      <div
        className={SURFACE_CLASS}
        aria-describedby={describedBy === '' ? undefined : describedBy}
      >
        {editor === null ? (
          <div className="min-h-[320px] px-4 py-4" aria-busy="true" />
        ) : (
          <>
            <EditorToolbar
              editor={editor}
              isUploading={isUploading}
              onPickImage={() => fileInputRef.current?.click()}
            />
            <EditorContent editor={editor} />
          </>
        )}
      </div>

      <input type="hidden" name={name} value={content} />

      {/* name 이 없어 폼과 함께 전송되지 않는다. 업로드는 서버 액션이 따로 처리한다. */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(event) => {
          void upload(Array.from(event.target.files ?? []))
          // 같은 파일을 연달아 고를 수 있게 값을 비운다.
          event.target.value = ''
        }}
      />

      {hint === undefined ? null : (
        <p id={hintId} className="text-ink-muted text-[14px]">
          {hint}
        </p>
      )}

      {uploadError === null ? null : (
        <p role="alert" className="text-badge-red text-[13px] font-medium">
          {uploadError}
        </p>
      )}

      {error === undefined ? null : (
        <p id={errorId} role="alert" className="text-badge-red text-[13px] font-medium">
          {error}
        </p>
      )}
    </div>
  )
}
