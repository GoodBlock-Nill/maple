'use client'

import Link from 'next/link'
import { useState } from 'react'

import { Button, Dialog, useToast } from '@/components/ui'
import { applyReplyTemplate } from '@/lib/utils/inquiry-reply-template'

import type { InquiryReplyTemplateOption } from '@/lib/data/inquiry-reply-templates'
import type { InquiryPlaceholderSource } from '@/lib/utils/inquiry-reply-template'

export type TemplateApplyMode = 'replace' | 'append'

const SELECT_CLASS =
  'rounded-panel border-line bg-surface text-ink focus:border-accent focus:outline-accent/40 h-9 min-w-[200px] max-w-full border px-3 text-[13px] focus:outline-2'

/**
 * 답변 템플릿 불러오기.
 *
 * 선택지는 **공통 + 이 문의의 카테고리**, 사용 중인 것만이다(서버가 이미 걸러서 준다).
 * 웹 문의든 이메일 문의든 같은 답변 칸을 쓰므로 이 컨트롤도 하나다.
 *
 * 자리표시자는 **불러오는 순간** 이 문의의 값으로 바뀐다(`applyReplyTemplate`). 저장된
 * 답변에 `{{닉네임}}` 이 남으면 사용자 화면에 그대로 노출된다.
 *
 * 이미 쓰던 글이 있으면 확인을 세운다 — 되돌릴 수 없는 조작이라서다. 확인 창에서
 * '끝에 추가'를 고르면 쓰던 글을 지우지 않고 이어 붙인다(여러 문안을 겹쳐 쓰는 답변이
 * 흔하다). 빈칸이면 잃을 것이 없으므로 묻지 않고 바로 넣는다.
 */
export function InquiryReplyTemplatePicker({
  templates,
  inquiry,
  hasContent,
  onApply,
}: {
  templates: readonly InquiryReplyTemplateOption[]
  inquiry: InquiryPlaceholderSource
  /** 답변 칸에 이미 글이 있는가. 확인 창을 세울지 가른다. */
  hasContent: boolean
  onApply: (text: string, mode: TemplateApplyMode) => void
}) {
  const [selectedId, setSelectedId] = useState('')
  const [isConfirmOpen, setConfirmOpen] = useState(false)
  const { showToast } = useToast()

  const selected = templates.find((template) => template.id === selectedId)

  function apply(mode: TemplateApplyMode): void {
    if (selected === undefined) {
      return
    }

    onApply(applyReplyTemplate(selected.body, inquiry), mode)
    setConfirmOpen(false)
    showToast(
      mode === 'append'
        ? `'${selected.name}' 를 답변 끝에 추가했습니다.`
        : `'${selected.name}' 템플릿을 불러왔습니다.`,
      'success',
    )
  }

  if (templates.length === 0) {
    return (
      <p className="text-muted text-[12px]">
        이 카테고리에서 쓸 수 있는 답변 템플릿이 없습니다.{' '}
        <Link href="/inquiries/reply-templates" className="text-accent-strong hover:underline">
          답변 템플릿 관리
        </Link>
        에서 등록할 수 있습니다.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-muted text-[13px]" htmlFor="inquiry-reply-template">
        템플릿 불러오기
      </label>
      <select
        id="inquiry-reply-template"
        value={selectedId}
        onChange={(event) => setSelectedId(event.target.value)}
        className={SELECT_CLASS}
      >
        <option value="">템플릿 선택</option>
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.isCommon ? `[공통] ${template.name}` : template.name}
          </option>
        ))}
      </select>
      <Button
        variant="secondary"
        size="sm"
        disabled={selected === undefined}
        onClick={() => (hasContent ? setConfirmOpen(true) : apply('replace'))}
      >
        불러오기
      </Button>

      <Dialog
        open={isConfirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="템플릿 적용"
        description="작성 중인 답변이 지워집니다. 템플릿을 적용할까요? 쓰던 글을 두고 이어 붙이려면 '끝에 추가'를 누르세요."
      >
        <div className="flex flex-col gap-4">
          <p className="text-ink text-[13px]">{selected?.name}</p>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              취소
            </Button>
            <Button variant="secondary" onClick={() => apply('append')}>
              끝에 추가
            </Button>
            <Button variant="danger" onClick={() => apply('replace')}>
              템플릿으로 바꾸기
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
