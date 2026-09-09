'use client'

import { useActionState, useCallback, useEffect } from 'react'

import { LegalEditor } from '@/components/legal/LegalEditor'
import { LegalPublishFields } from '@/components/legal/LegalPublishFields'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { FormBanner } from '@/components/ui/FormField'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { EMPTY_FORM_STATE, type FormState } from '@/lib/actions/form-state'
import { saveLegalVersionAction } from '@/lib/actions/legal-actions'

import type { LegalSlug } from '@/lib/constants/legal'
import { LEGAL_SUMMARY_MAX_LENGTH } from '@/lib/validation/legal'

import type { LegalPublishMode } from '@/lib/validation/legal'

/**
 * 약관 개정본 편집 폼.
 *
 * 새 초안과 기존 초안 수정이 한 컴포넌트다. 다른 것은 숨은 `id` 하나뿐이고 서버
 * 액션도 그 값으로 분기한다(`saveLegalVersionAction`).
 *
 * 발행본을 열면 `isReadOnly` 다 — 발행한 문안은 고치지 않고 새 버전을 쌓는다.
 * 그때는 본문만 그대로 들고 "새 초안 만들기"로 넘어가게 한다.
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

  const runSave = useCallback(
    (prevState: FormState, formData: FormData) => saveLegalVersionAction(prevState, formData),
    [],
  )

  const [state, formAction, isPending] = useActionState(runSave, EMPTY_FORM_STATE)

  useEffect(() => {
    if (state.message !== undefined) {
      showToast(state.message, 'success')
    }
  }, [state, showToast])

  const errors = state.fieldErrors ?? {}

  return (
    <form action={formAction} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
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
              hint="사용자 사이트에는 보이지 않습니다. 버전 이력에서 무엇이 바뀌었는지 알아보는 용도입니다."
              error={errors.summary}
            />
          </CardBody>
        </Card>

        <LegalEditor
          name="content"
          label="본문"
          defaultValue={defaultContent}
          hint="장(H2)은 사용자 사이트 목차 항목이 됩니다. 표는 머리글 행을 켜 두세요."
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
              defaultMode={defaultMode}
              versionError={errors.version}
              effectiveDateError={errors.effectiveDate}
              isLocked={isReadOnly}
            />

            <div className="border-line flex items-center gap-2 border-t pt-3">
              <Button type="submit" disabled={isPending || isReadOnly}>
                {isPending ? '저장 중…' : '저장'}
              </Button>
              <Button href="/legal" variant="secondary">
                목록으로
              </Button>
            </div>

            {isReadOnly ? (
              <p className="text-muted text-[12px]">
                이미 발행한 개정본입니다. 문안을 바꾸려면 아래 이력에서 “이 버전으로 새 초안
                만들기”를 눌러 주세요.
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </form>
  )
}
