'use client'

import { useActionState, useCallback, useEffect, useRef, useState } from 'react'

import { LegalEditor } from '@/components/legal/LegalEditor'
import { LegalPublishConfirm } from '@/components/legal/LegalPublishConfirm'
import { LegalPublishFields } from '@/components/legal/LegalPublishFields'
import { useUnsavedGuard } from '@/components/legal/use-unsaved-guard'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { FormBanner } from '@/components/ui/FormField'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { EMPTY_FORM_STATE, type FormState } from '@/lib/actions/form-state'
import { saveLegalVersionAction } from '@/lib/actions/legal-actions'
import { LEGAL_SUMMARY_MAX_LENGTH } from '@/lib/validation/legal'
import { legalConfirmCopy } from '@/lib/validation/legal-state'

import type { LegalSlug } from '@/lib/constants/legal'
import type { LegalPublishMode } from '@/lib/validation/legal'
import type { LegalConfirmCopy } from '@/lib/validation/legal-state'
import type { FormEvent } from 'react'

/**
 * 약관 개정본 편집 폼.
 *
 * 새 초안과 기존 초안 수정이 한 컴포넌트다. 다른 것은 숨은 `id` 하나뿐이고 서버
 * 액션도 그 값으로 분기한다(`saveLegalVersionAction`).
 *
 * 발행본을 열면 `isReadOnly` 다 — 발행한 문안은 고치지 않고 새 버전을 쌓는다. 그때는
 * 에디터까지 통째로 잠그고(툴바 없음 · 회색 바탕 · 저장 버튼 없음) 다음 행동은 화면
 * 위 배너가 안내한다(`LegalReadOnlyBanner`).
 *
 * 발행·예약 저장은 되돌릴 수 없어 한 번 더 묻는다. 임시저장은 묻지 않는다 —
 * 되돌릴 수 있는 저장까지 확인창을 띄우면 운영자가 읽지 않고 누르는 습관이 든다.
 */

type LegalFormProps = {
  slug: LegalSlug
  /** 수정 중인 개정본 id. 새 초안이면 빈 문자열. */
  versionId: string
  defaultVersion: string
  defaultEffectiveDate: string
  defaultSummary: string
  defaultContent: string
  defaultMode: LegalPublishMode
  isReadOnly: boolean
}

const EDITOR_HINT = '장(H2)은 사용자 사이트 목차 항목이 됩니다. 표는 머리글 행을 켜 두세요.'
const READ_ONLY_HINT = '발행본이라 읽기 전용입니다. 새 초안을 만들면 이 본문을 그대로 이어받습니다.'

/** 확인창 문구에 넣을 시행일. 제출 순간의 입력값을 그대로 읽는다. */
function readEffectiveDate(form: HTMLFormElement): string {
  const element = form.elements.namedItem('effectiveDate')

  return element instanceof HTMLInputElement ? element.value : ''
}

export function LegalForm({
  slug,
  versionId,
  defaultVersion,
  defaultEffectiveDate,
  defaultSummary,
  defaultContent,
  defaultMode,
  isReadOnly,
}: LegalFormProps) {
  const { showToast } = useToast()
  const [mode, setMode] = useState<LegalPublishMode>(defaultMode)
  const [isDirty, setDirty] = useState(false)
  const [confirm, setConfirm] = useState<LegalConfirmCopy | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)
  /* 확인을 마친 제출인지. 확인창의 "발행"이 같은 폼을 다시 제출하므로, 이 표시가
     없으면 onSubmit 이 또 확인창을 열어 영원히 저장되지 않는다. */
  const isConfirmedRef = useRef(false)

  const runSave = useCallback(
    (prevState: FormState, formData: FormData) => saveLegalVersionAction(prevState, formData),
    [],
  )

  const [state, formAction, isPending] = useActionState(runSave, EMPTY_FORM_STATE)

  /* 저장이 끝나면 리다이렉트가 이어지므로(isPending 유지) 경고를 켜 둘 이유가 없다. */
  useUnsavedGuard(isDirty && !isPending && !isReadOnly)

  useEffect(() => {
    if (state.message !== undefined) {
      showToast(state.message, 'success')
    }
  }, [state, showToast])

  const markDirty = useCallback(() => setDirty(true), [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (isConfirmedRef.current) {
      isConfirmedRef.current = false

      return
    }

    const copy = legalConfirmCopy(mode, readEffectiveDate(event.currentTarget))

    if (copy === null) {
      return
    }

    /* React 19 는 기본 동작이 막힌 제출에서 form action 을 실행하지 않는다.
       확인창의 답을 받은 뒤 같은 폼을 다시 제출한다. */
    event.preventDefault()
    formRef.current = event.currentTarget
    setConfirm(copy)
  }

  function submitConfirmed() {
    isConfirmedRef.current = true
    setConfirm(null)
    formRef.current?.requestSubmit()
  }

  const errors = state.fieldErrors ?? {}

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"
    >
      <input type="hidden" name="slug" value={slug} />
      {versionId === '' ? null : <input type="hidden" name="id" value={versionId} />}

      <div className="flex flex-col gap-5">
        <Card>
          <CardBody className="flex flex-col gap-4">
            <FormBanner message={state.formError} />

            <Textarea
              label="변경 요약"
              name="summary"
              rows={2}
              maxLength={LEGAL_SUMMARY_MAX_LENGTH}
              defaultValue={defaultSummary}
              disabled={isReadOnly}
              onChange={markDirty}
              hint="사용자 사이트에는 보이지 않습니다. 버전 이력에서 무엇이 바뀌었는지 알아보는 용도입니다."
              error={errors.summary}
            />
          </CardBody>
        </Card>

        <LegalEditor
          name="content"
          label="본문"
          defaultValue={defaultContent}
          isReadOnly={isReadOnly}
          onChange={markDirty}
          hint={isReadOnly ? READ_ONLY_HINT : EDITOR_HINT}
          error={errors.content}
        />
      </div>

      <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardHeader title="발행" />
          <CardBody className="flex flex-col gap-4">
            <LegalPublishFields
              defaultVersion={defaultVersion}
              defaultEffectiveDate={defaultEffectiveDate}
              mode={mode}
              onModeChange={setMode}
              onChange={markDirty}
              versionError={errors.version}
              effectiveDateError={errors.effectiveDate}
              isLocked={isReadOnly}
            />

            <div className="border-line flex items-center gap-2 border-t pt-3">
              {isReadOnly ? null : (
                <Button type="submit" disabled={isPending}>
                  {isPending ? '저장 중…' : '저장'}
                </Button>
              )}
              <Button href="/legal" variant="secondary">
                목록으로
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <LegalPublishConfirm
        copy={confirm}
        onCancel={() => setConfirm(null)}
        onConfirm={submitConfirmed}
      />
    </form>
  )
}
