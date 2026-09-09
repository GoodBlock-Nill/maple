'use client'

import { WiredField } from '@/components/settings/wiring'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { URL_MAX } from '@/lib/validation/settings'

import type { SiteSettingsRecord } from '@/lib/data/settings'

/**
 * 사이트 설정의 "크리에이터 소개" 묶음.
 *
 * `SiteSettingsForm` 에서 떼어 낸 이유는 길이뿐이다(파일 200줄 상한). 상태를 갖지
 * 않고 같은 `<form>` 안에서 렌더되므로, 값 수집과 제출은 그대로 부모 폼이 한다.
 */
export function SiteCreatorFields({
  settings,
  errors,
}: {
  settings: SiteSettingsRecord | null
  errors: Record<string, string>
}) {
  return (
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
  )
}
