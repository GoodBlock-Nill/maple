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
import { EMAIL_MAX, URL_MAX } from '@/lib/validation/settings'

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

      <fieldset className="border-line flex flex-col gap-5 border-t pt-5">
        <legend className="text-ink text-[14px] font-bold">크리에이터 소개</legend>

        <div className="grid gap-5 md:grid-cols-2">
          <WiredField field="creatorName">
            <Input
              label="이름"
              name="creatorName"
              defaultValue={settings?.creatorName ?? ''}
              maxLength={6}
              hint="소개 화면에 100px 크기로 크게 찍힙니다. 7자부터 패널 밖으로 나가 6자로 제한합니다."
              error={errors.creatorName}
            />
          </WiredField>
          <WiredField field="creatorSlogan">
            <Input
              label="슬로건"
              name="creatorSlogan"
              defaultValue={settings?.creatorSlogan ?? ''}
              maxLength={40}
              hint="소개 패널의 주황색 한 줄. PC 약 26자 · 폰 약 17자마다 줄이 바뀝니다."
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
            maxLength={4000}
            hint="소개 패널 본문. 문단은 빈 줄 두 개로 나누고, 문단 안 줄바꿈은 그대로 유지됩니다."
            error={errors.creatorIntro}
          />
        </WiredField>

        <div className="grid gap-5 md:grid-cols-2">
          <WiredField field="creatorPhotoUrl">
            <Input
              label="사진 주소"
              name="creatorPhotoUrl"
              defaultValue={settings?.creatorPhotoUrl ?? ''}
              maxLength={URL_MAX}
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
