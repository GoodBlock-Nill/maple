'use client'

import { EditorContent, useEditor } from '@tiptap/react'
import { useId, useState } from 'react'

import { createLegalExtensions } from '@/components/editor/legal-extensions'
import { LEGAL_EDITOR_CLASS } from '@/components/legal/legal-editor-typography'
import { LegalToolbar } from '@/components/legal/LegalToolbar'

/**
 * 약관 본문 에디터(Tiptap).
 *
 * 뉴스 에디터(`PostEditor`)와 같은 계약이다 — 값은 **숨은 input** 하나로 서버
 * 액션에 나간다. 에디터를 상위 폼 상태로 끌어올리면 한 글자마다 리렌더되어
 * ProseMirror 가 매번 새 문서를 받고 한글 조합(IME)이 끊긴다.
 *
 * `immediatelyRender: false` 는 Next 의 서버 렌더에서 필수다. 켜 두면 서버에서
 * ProseMirror 가 DOM 을 만들려다 하이드레이션 불일치가 난다.
 */

const PLACEHOLDER = '약관 본문을 입력해 주세요'

/**
 * `overflow-hidden` 을 쓰지 않는다. 넣는 순간 이 요소가 스크롤 컨테이너가 되어
 * 툴바의 `position: sticky` 가 통째로 무력화된다.
 */
const SURFACE_CLASS = 'rounded-card border border-line bg-surface'

type LegalEditorProps = {
  /** 폼 필드 이름. 서버 액션이 이 이름으로 본문을 읽는다. */
  name: string
  label: string
  defaultValue: string
  hint?: string
  error?: string
}

export function LegalEditor({ name, label, defaultValue, hint, error }: LegalEditorProps) {
  const hintId = useId()
  const errorId = useId()
  const [content, setContent] = useState(defaultValue)

  const editor = useEditor({
    extensions: createLegalExtensions(PLACEHOLDER),
    content: defaultValue,
    immediatelyRender: false,
    editorProps: {
      /* ProseMirror 루트에 직접 붙인다. 래퍼에 붙이면 실제 입력 요소(role=textbox)
         에는 이름이 없어 보조기술이 "편집 영역"으로만 읽는다. */
      attributes: {
        class: LEGAL_EDITOR_CLASS,
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
      },
    },
    onUpdate: ({ editor: instance }) => {
      /* 빈 문서도 `<p></p>` 를 내놓는다. 그대로 보내면 검증이 "내용 있음"으로 읽으므로
         빈 상태는 빈 문자열로 눌러서 내보낸다. */
      setContent(instance.isEmpty ? '' : instance.getHTML())
    },
  })

  const describedBy = [hint === undefined ? null : hintId, error === undefined ? null : errorId]
    .filter((id) => id !== null)
    .join(' ')

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-ink text-[13px] font-semibold">{label}</span>

      <div
        className={SURFACE_CLASS}
        aria-describedby={describedBy === '' ? undefined : describedBy}
      >
        {editor === null ? (
          <div className="min-h-[420px] px-4 py-4" aria-busy="true" />
        ) : (
          <>
            <LegalToolbar editor={editor} />
            <EditorContent editor={editor} />
          </>
        )}
      </div>

      <input type="hidden" name={name} value={content} />

      {hint === undefined ? null : (
        <p id={hintId} className="text-muted text-[12px]">
          {hint}
        </p>
      )}

      {error === undefined ? null : (
        <p id={errorId} role="alert" className="text-danger text-[12px] font-medium">
          {error}
        </p>
      )}
    </div>
  )
}
