'use client'

import { useActionState, useCallback, useRef, useState } from 'react'

import { InquiryNoteDeleteButton } from '@/components/inquiries/InquiryNoteDeleteButton'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  FormBanner,
  Textarea,
  useToast,
} from '@/components/ui'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { createInquiryNoteAction } from '@/lib/actions/inquiry-note-actions'
import { formatDateTime } from '@/lib/utils/format-date'
import {
  INQUIRY_NOTE_MAX_LENGTH,
  INQUIRY_NOTE_VISIBILITY_NOTICE,
} from '@/lib/validation/inquiry-assignment'

import type { FormState } from '@/lib/actions/form-state'
import type { InquiryNoteItem } from '@/lib/data/inquiry-assignment'

/**
 * 운영자 전용 내부 메모.
 *
 * "고객에게 보이지 않습니다"를 **카드 머리와 입력칸 양쪽에** 적는다. 답변 폼과 생김새가
 * 비슷해서, 한 곳에만 적으면 스크롤 위치에 따라 안내를 못 보고 사용자에게 보낼 말을
 * 여기에 쓴다(그 반대도 마찬가지다).
 *
 * 최신이 위다 — 메모는 "지금 판단"을 찾으려고 보는 것이라 오래된 것부터 읽지 않는다.
 */
export function InquiryNotes({
  inquiryId,
  notes,
  canWrite,
}: {
  inquiryId: string
  notes: readonly InquiryNoteItem[]
  canWrite: boolean
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [body, setBody] = useState('')
  const { showToast } = useToast()

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await createInquiryNoteAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        setBody('')
        formRef.current?.reset()
      }

      return result
    },
    [showToast],
  )

  const [state, formAction, isPending] = useActionState(run, EMPTY_FORM_STATE)

  return (
    <Card>
      <CardHeader
        title="내부 메모"
        description="확인한 사실·보류 사유처럼 다음 사람이 알아야 할 것을 남깁니다."
        action={<Badge tone="warn">{INQUIRY_NOTE_VISIBILITY_NOTICE}</Badge>}
      />
      <CardBody className="flex flex-col gap-4">
        {canWrite && (
          <form ref={formRef} action={formAction} className="flex flex-col gap-3">
            <input type="hidden" name="inquiryId" value={inquiryId} />

            <FormBanner message={state.formError} />

            <Textarea
              label="메모 내용"
              name="body"
              rows={3}
              required
              maxLength={INQUIRY_NOTE_MAX_LENGTH}
              placeholder="예: 결제 로그 확인함. 환불 기준 확인 후 답변 예정."
              hint={`${INQUIRY_NOTE_VISIBILITY_NOTICE}. 사용자 화면과 답신 메일 어디에도 나가지 않습니다.`}
              error={state.fieldErrors?.body}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />

            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? '남기는 중…' : '메모 남기기'}
              </Button>
            </div>
          </form>
        )}

        {notes.length === 0 ? (
          <EmptyState
            title="아직 남긴 메모가 없습니다."
            description="답변 전에 확인한 사실을 적어 두면 다음 사람이 같은 확인을 반복하지 않습니다."
          />
        ) : (
          <ul className="flex flex-col gap-3" data-testid="inquiry-notes">
            {notes.map((note) => (
              <li key={note.id} className="border-line bg-page rounded-card border px-4 py-3">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-ink text-[13px] font-semibold">{note.authorNickname}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-muted text-[12px]">{formatDateTime(note.createdAt)}</span>
                    {canWrite && note.isMine && (
                      <InquiryNoteDeleteButton noteId={note.id} inquiryId={inquiryId} />
                    )}
                  </span>
                </div>
                {/* 운영자가 쓴 평문이다. 줄바꿈만 살리고 마크업은 해석하지 않는다. */}
                <p className="text-ink text-[14px] leading-relaxed whitespace-pre-line">
                  {note.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
