'use client'

import { useActionState, useCallback } from 'react'

import { SiteCreatorFields } from '@/components/settings/SiteCreatorFields'
import { WiredField } from '@/components/settings/wiring'
import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { saveSiteSettingsAction } from '@/lib/actions/settings-actions'
import { EMAIL_MAX, URL_MAX } from '@/lib/validation/settings'

import type { FormState } from '@/lib/actions/form-state'
import type { SiteSettingsRecord } from '@/lib/data/settings'

/**
 * 사이트 설정 폼.
 *
 * 필드마다 사용자 사이트가 이 값을 실제로 읽는지(`사이트 반영`) 아니면 아직 상수를
 * 쓰는지(`미연동`)를 태그로 붙인다 — components/settings/wiring.tsx.
 *
 * `canWrite` 가 false 면 값은 그대로 보여 주고 저장 버튼만 그리지 않는다.
 */
type SiteSettingsFormProps = { settings: SiteSettingsRecord | null; canWrite: boolean }

export function SiteSettingsForm({ settings, canWrite }: SiteSettingsFormProps) {
  const { showToast } = useToast()

  const runSave = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await saveSiteSettingsAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
      }

      return result
    },
    [showToast],
  )

  const [state, formAction, isPending] = useActionState(runSave, EMPTY_FORM_STATE)
  const errors = state.fieldErrors ?? {}

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <FormBanner message={state.formError} />

      <div className="grid gap-5 md:grid-cols-2">
        <WiredField field="gameName">
          <Input
            label="사이트 이름"
            name="gameName"
            required
            defaultValue={settings?.gameName ?? '글자월드'}
            maxLength={50}
            hint="브라우저 탭 제목과 공유(OG) 카드 제목에 들어갑니다."
            error={errors.gameName}
          />
        </WiredField>
        <WiredField field="worldId">
          <Input
            label="월드 ID"
            name="worldId"
            defaultValue={settings?.worldId ?? ''}
            maxLength={50}
            hint="메이플스토리 월드의 월드 식별자. /play 가 이 값으로 이동합니다."
            error={errors.worldId}
          />
        </WiredField>
        <WiredField field="discordUrl">
          <Input
            label="디스코드 주소"
            name="discordUrl"
            type="url"
            defaultValue={settings?.discordUrl ?? ''}
            placeholder="https://discord.gg/..."
            maxLength={URL_MAX}
            hint="푸터 디스코드 버튼과 /discord 이동에 쓰입니다. 표시 제약이 아니라 주소 저장용 상한입니다."
            error={errors.discordUrl}
          />
        </WiredField>
        <WiredField field="youtubeUrl">
          <Input
            label="유튜브 주소"
            name="youtubeUrl"
            type="url"
            defaultValue={settings?.youtubeUrl ?? ''}
            placeholder="https://youtube.com/@..."
            maxLength={URL_MAX}
            hint="푸터 유튜브 버튼에 쓰입니다. 소개 화면 상단 영상은 히어로 배너가 없을 때만 이 주소의 영상을 씁니다."
            error={errors.youtubeUrl}
          />
        </WiredField>
        <WiredField field="contactEmail">
          <Input
            label="연락 이메일"
            name="contactEmail"
            type="email"
            defaultValue={settings?.contactEmail ?? ''}
            placeholder="contact@example.com"
            maxLength={EMAIL_MAX}
            hint="푸터의 이메일 버튼에 그대로 노출됩니다."
            error={errors.contactEmail}
          />
        </WiredField>
        <WiredField field="copyright">
          <Input
            label="저작권 문구"
            name="copyright"
            defaultValue={settings?.copyright ?? ''}
            maxLength={200}
            hint="푸터 하단 한 줄. 30자를 넘으면 폰에서 줄바꿈됩니다."
            error={errors.copyright}
          />
        </WiredField>
      </div>

      <WiredField field="ipNotice">
        <Textarea
          label="지식재산권 고지"
          name="ipNotice"
          rows={3}
          defaultValue={settings?.ipNotice ?? ''}
          maxLength={500}
          hint="개인정보처리방침 하단의 지식재산권 고지 문단으로 노출됩니다."
          error={errors.ipNotice}
        />
      </WiredField>

      <SiteCreatorFields settings={settings} errors={errors} />

      {canWrite && (
        <div className="border-line flex justify-end border-t pt-4">
          <Button type="submit" disabled={isPending}>
            {isPending ? '저장 중…' : '저장'}
          </Button>
        </div>
      )}
    </form>
  )
}
