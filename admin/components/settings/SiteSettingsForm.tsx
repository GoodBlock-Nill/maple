'use client'

import { useActionState, useCallback } from 'react'

import { WiredField } from '@/components/settings/wiring'
import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { saveSiteSettingsAction } from '@/lib/actions/settings-actions'

import type { FormState } from '@/lib/actions/form-state'
import type { SiteSettingsRecord } from '@/lib/data/settings'

/**
 * 사이트 설정 폼.
 *
 * 필드마다 사용자 사이트가 이 값을 실제로 읽는지(`사이트 반영`) 아니면 아직 상수를
 * 쓰는지(`미연동`)를 태그로 붙인다 — components/settings/wiring.tsx.
 */
export function SiteSettingsForm({ settings }: { settings: SiteSettingsRecord | null }) {
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
            error={errors.gameName}
          />
        </WiredField>
        <WiredField field="worldId">
          <Input
            label="월드 ID"
            name="worldId"
            defaultValue={settings?.worldId ?? ''}
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
            error={errors.contactEmail}
          />
        </WiredField>
        <WiredField field="copyright">
          <Input
            label="저작권 문구"
            name="copyright"
            defaultValue={settings?.copyright ?? ''}
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
          error={errors.ipNotice}
        />
      </WiredField>

      <fieldset className="border-line flex flex-col gap-5 border-t pt-5">
        <legend className="text-ink text-[14px] font-bold">크리에이터 소개</legend>

        <div className="grid gap-5 md:grid-cols-2">
          <WiredField field="creatorName">
            <Input
              label="이름"
              name="creatorName"
              defaultValue={settings?.creatorName ?? ''}
              error={errors.creatorName}
            />
          </WiredField>
          <WiredField field="creatorSlogan">
            <Input
              label="슬로건"
              name="creatorSlogan"
              defaultValue={settings?.creatorSlogan ?? ''}
              error={errors.creatorSlogan}
              data-testid="creator-slogan-input"
            />
          </WiredField>
        </div>

        <WiredField field="creatorIntro">
          <Textarea
            label="소개글"
            name="creatorIntro"
            rows={8}
            defaultValue={settings?.creatorIntro ?? ''}
            hint="문단은 빈 줄 두 개로 나눕니다."
            error={errors.creatorIntro}
          />
        </WiredField>

        <div className="grid gap-5 md:grid-cols-2">
          <WiredField field="creatorPhotoUrl">
            <Input
              label="사진 주소"
              name="creatorPhotoUrl"
              defaultValue={settings?.creatorPhotoUrl ?? ''}
              hint="아래에서 파일을 올리면 이 값이 업로드 주소로 바뀝니다."
              error={errors.creatorPhotoUrl}
            />
          </WiredField>
          <Input
            label="사진 파일"
            name="creatorPhotoFile"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            hint="public-assets/site/creator-photo.* 로 덮어씁니다."
            error={errors.creatorPhotoFile}
            className="h-auto py-2"
          />
        </div>
      </fieldset>

      <div className="border-line flex justify-end border-t pt-4">
        <Button type="submit" disabled={isPending}>
          {isPending ? '저장 중…' : '저장'}
        </Button>
      </div>
    </form>
  )
}
