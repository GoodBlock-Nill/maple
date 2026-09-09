'use client'

import { useActionState, useCallback, useState } from 'react'

import { HeroBannerMediaFields } from '@/components/settings/HeroBannerMediaFields'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormBanner } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { saveHeroBannerAction } from '@/lib/actions/settings-actions'
import { kstDateTimeLocal } from '@/lib/validation/settings'

import type { FormState } from '@/lib/actions/form-state'
import type { HeroBannerRecord } from '@/lib/data/settings'

/**
 * 배너 추가·수정 다이얼로그.
 *
 * `banner` 가 없으면 추가다. 노출 기간은 비워 두면 "제한 없음"이고, 종료가 시작보다
 * 빠르면 DB 제약(hero_banners_period)에 걸리므로 스키마에서 먼저 거른다.
 *
 * 미디어(이미지 · 유튜브)는 유형에 따라 칸이 갈려 `HeroBannerMediaFields` 가 맡는다.
 */
export function HeroBannerDialog({
  banner,
  nextSortOrder,
  trigger,
}: {
  banner: HeroBannerRecord | null
  /** 새 배너의 기본 순서. 목록 맨 뒤에 붙인다. */
  nextSortOrder: number
  trigger: string
}) {
  const [isOpen, setOpen] = useState(false)
  const { showToast } = useToast()

  const runSave = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await saveHeroBannerAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        setOpen(false)
      }

      return result
    },
    [showToast],
  )

  const [state, formAction, isPending] = useActionState(runSave, EMPTY_FORM_STATE)
  const errors = state.fieldErrors ?? {}

  return (
    <>
      <Button
        size="sm"
        variant={banner === null ? 'primary' : 'secondary'}
        onClick={() => setOpen(true)}
      >
        {trigger}
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => setOpen(false)}
        title={banner === null ? '배너 추가' : '배너 수정'}
        description="이미지 또는 유튜브 영상과 노출 기간을 지정합니다. 기간을 비우면 항상 노출됩니다."
      >
        <form action={formAction} className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
          <input type="hidden" name="id" value={banner?.id ?? ''} />

          <FormBanner message={state.formError} />

          <Input
            label="제목"
            name="title"
            required
            defaultValue={banner?.title ?? ''}
            error={errors.title}
          />
          <Input
            label="부제"
            name="subtitle"
            defaultValue={banner?.subtitle ?? ''}
            error={errors.subtitle}
          />
          <HeroBannerMediaFields
            defaultMediaType={banner?.mediaType ?? 'image'}
            defaultImageUrl={banner?.imageUrl ?? ''}
            defaultVideoUrl={banner?.videoUrl ?? ''}
            errors={{
              mediaType: errors.mediaType,
              imageUrl: errors.imageUrl,
              imageFile: errors.imageFile,
              videoUrl: errors.videoUrl,
            }}
          />
          <Input
            label="링크"
            name="linkUrl"
            defaultValue={banner?.linkUrl ?? ''}
            error={errors.linkUrl}
          />
          <Input
            label="버튼 문구"
            name="ctaLabel"
            defaultValue={banner?.ctaLabel ?? ''}
            error={errors.ctaLabel}
          />
          <Input
            label="정렬 순서"
            name="sortOrder"
            inputMode="numeric"
            defaultValue={String(banner?.sortOrder ?? nextSortOrder)}
            error={errors.sortOrder}
          />
          <Input
            label="노출 시작"
            name="startsAt"
            type="datetime-local"
            defaultValue={kstDateTimeLocal(banner?.startsAt)}
            error={errors.startsAt}
          />
          <Input
            label="노출 종료"
            name="endsAt"
            type="datetime-local"
            defaultValue={kstDateTimeLocal(banner?.endsAt)}
            error={errors.endsAt}
          />

          <label className="text-ink flex w-fit items-center gap-2 text-[13px] font-semibold">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={banner?.isActive ?? true}
              className="accent-accent h-4 w-4"
            />
            노출
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? '저장 중…' : '저장'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}
