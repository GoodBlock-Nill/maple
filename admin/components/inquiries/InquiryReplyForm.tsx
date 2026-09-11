'use client'

import { useActionState, useCallback, useRef, useState } from 'react'

import { InquiryReplyTemplatePicker } from '@/components/inquiries/InquiryReplyTemplatePicker'
import { Button, Card, CardBody, CardHeader, FormBanner, Textarea, useToast } from '@/components/ui'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { replyToInquiryAction } from '@/lib/actions/inquiries-actions'
import {
  INQUIRY_REPLY_MAX_LENGTH,
  INQUIRY_REPLY_NEXT_STATUSES,
  INQUIRY_STATUS_LABELS,
} from '@/lib/validation/inquiries'

import type { TemplateApplyMode } from '@/components/inquiries/InquiryReplyTemplatePicker'
import type { FormState } from '@/lib/actions/form-state'
import type { InquiryReplyTemplateOption } from '@/lib/data/inquiry-reply-templates'
import type { InquiryPlaceholderSource } from '@/lib/utils/inquiry-reply-template'

const OPERATOR_NAME = '운영자'

/**
 * 답변 작성.
 *
 * 사용자 화면은 답변을 **평문**으로 그린다(줄바꿈만 살린다). 마크다운을 지원하는
 * 것처럼 보이면 `**강조**` 가 그대로 노출되므로 편집기를 붙이지 않는다.
 *
 * 성공하면 폼을 직접 비운다 — `revalidatePath` 로 스레드는 갱신되지만 입력값은
 * 클라이언트 상태라 그대로 남아, 같은 답변을 두 번 등록하기 쉽다.
 *
 * 이메일 문의는 **되돌릴 수 없는 발송**이라 문구를 바꾼다. "답변 등록"이라고 적혀
 * 있으면 운영자가 콘솔 안에만 남는 메모로 오해하고 계정 정보를 적을 수 있다.
 *
 * 입력을 상태로 쥐는 이유는 '템플릿 불러오기' 때문이다(2026-09-11). 비제어 textarea 에
 * DOM 으로 값을 밀어 넣으면 React 가 그 사실을 모르고, 글자수 표시가 옛 숫자에 멈춘다.
 */
const COPY = {
  web: {
    description: "등록하면 사용자의 '내 문의 내역' 화면에 바로 표시됩니다.",
    hint: '사용자의 ‘내 문의 내역’ 화면에 평문으로 노출됩니다. 줄바꿈은 유지되고 마크다운은 해석되지 않습니다.',
    submit: '답변 등록',
    pending: '등록 중…',
  },
  email: {
    description: '저장한 답신은 사용자의 메일 주소로 발송되고 이 스레드에 남습니다.',
    hint: '사용자의 메일 주소로 발송됩니다. 계정 정보나 개인정보는 적지 마세요.',
    submit: '이메일로 답신 보내기',
    pending: '발송 중…',
  },
} as const

export function InquiryReplyForm({
  inquiryId,
  adminNickname,
  isEmail,
  templates,
  inquiry,
}: {
  inquiryId: string
  adminNickname: string
  isEmail: boolean
  /** 이 문의에서 쓸 수 있는 답변 템플릿(공통 + 같은 카테고리 · 사용 중인 것만). */
  templates: readonly InquiryReplyTemplateOption[]
  /** 자리표시자 치환에 쓰는 문의 정보. */
  inquiry: InquiryPlaceholderSource
}) {
  const copy = isEmail ? COPY.email : COPY.web
  const formRef = useRef<HTMLFormElement>(null)
  const [content, setContent] = useState('')
  const { showToast } = useToast()

  const applyTemplate = useCallback((text: string, mode: TemplateApplyMode) => {
    /* 이어 붙일 때는 빈 줄 하나를 사이에 둔다. 두 문안이 한 문단으로 붙으면 사용자가
       읽을 때 어디서 이야기가 바뀌는지 알 수 없다. */
    setContent((current) =>
      mode === 'append' && current.trim() !== '' ? `${current.trimEnd()}\n\n${text}` : text,
    )
  }, [])

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await replyToInquiryAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        /* 본문은 상태가 쥐고 있으므로 직접 비운다. reset() 은 명의 체크박스·등록 후
           상태 셀렉트를 기본값으로 되돌리는 몫만 한다. */
        setContent('')
        formRef.current?.reset()
      }

      return result
    },
    [showToast],
  )

  const [state, formAction, isPending] = useActionState(run, EMPTY_FORM_STATE)

  return (
    <Card>
      <CardHeader title="답변 작성" description={copy.description} />
      <CardBody>
        <form ref={formRef} action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="inquiryId" value={inquiryId} />

          <FormBanner message={state.formError} />

          <InquiryReplyTemplatePicker
            templates={templates}
            inquiry={inquiry}
            hasContent={content.trim() !== ''}
            onApply={applyTemplate}
          />

          <Textarea
            label="답변 내용"
            name="content"
            rows={7}
            required
            maxLength={INQUIRY_REPLY_MAX_LENGTH}
            placeholder="사용자가 그대로 읽는 문장입니다."
            hint={copy.hint}
            error={state.fieldErrors?.content}
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-ink flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                name="useOperatorName"
                defaultChecked
                className="accent-accent size-4"
              />
              {`'${OPERATOR_NAME}' 명의로 표시`}
              <span className="text-muted">{`(해제하면 ${adminNickname})`}</span>
            </label>

            <div className="flex items-center gap-2">
              <label className="text-muted text-[13px]" htmlFor="inquiry-next-status">
                등록 후 상태
              </label>
              <select
                id="inquiry-next-status"
                name="nextStatus"
                defaultValue={INQUIRY_REPLY_NEXT_STATUSES[0]}
                className="rounded-panel border-line bg-surface text-ink focus:border-accent focus:outline-accent/40 h-9 border px-3 text-[13px] focus:outline-2"
              >
                {INQUIRY_REPLY_NEXT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {INQUIRY_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              <Button type="submit" disabled={isPending}>
                {isPending ? copy.pending : copy.submit}
              </Button>
            </div>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
