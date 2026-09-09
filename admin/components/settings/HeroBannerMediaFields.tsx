'use client'

import { useState } from 'react'

import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils/cn'
import { HERO_MEDIA_TYPES, type HeroMediaType } from '@/lib/validation/hero-banner'

/**
 * 배너 미디어 입력 — 이미지 한 장 또는 유튜브 영상.
 *
 * 유형에 따라 필요한 칸이 다르므로 **고르지 않은 쪽은 마운트하지 않는다**. 숨기기만
 * 하면 폼이 값을 계속 보내, 이미지로 되돌린 배너에 옛 영상 주소가 따라붙는다.
 *
 * 이미지 칸은 두 유형 모두에 남는다 — 영상 배너에서는 포스터(대체 이미지)다.
 * 그래서 유형을 오가도 입력해 둔 그림이 사라지지 않는다.
 */

const MEDIA_LABEL: Record<HeroMediaType, string> = {
  image: '이미지',
  youtube: '유튜브 영상',
}

/** public-assets 버킷이 받는 형식과 같다(PUBLIC_ASSET_EXTENSIONS). */
const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml'

type HeroBannerMediaFieldsProps = {
  defaultMediaType: HeroMediaType
  defaultImageUrl: string
  defaultVideoUrl: string
  errors: {
    mediaType?: string
    imageUrl?: string
    imageFile?: string
    videoUrl?: string
  }
}

export function HeroBannerMediaFields({
  defaultMediaType,
  defaultImageUrl,
  defaultVideoUrl,
  errors,
}: HeroBannerMediaFieldsProps) {
  const [mediaType, setMediaType] = useState<HeroMediaType>(defaultMediaType)
  const isVideo = mediaType === 'youtube'

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-ink text-[13px] font-semibold">미디어 유형</legend>

      <div className="border-line rounded-panel bg-page flex gap-1 border p-1">
        {HERO_MEDIA_TYPES.map((value) => (
          <label
            key={value}
            className={cn(
              'rounded-panel flex flex-1 cursor-pointer items-center justify-center px-3 py-1.5',
              'text-[13px] font-semibold transition-colors',
              'has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-2',
              mediaType === value
                ? 'bg-surface text-accent-strong border-accent/25 border'
                : 'text-muted hover:text-ink',
            )}
          >
            <input
              type="radio"
              name="mediaType"
              value={value}
              checked={mediaType === value}
              onChange={() => setMediaType(value)}
              className="sr-only"
            />
            {MEDIA_LABEL[value]}
          </label>
        ))}
      </div>

      {errors.mediaType !== undefined && (
        <p className="text-danger text-[12px] font-medium">{errors.mediaType}</p>
      )}

      {isVideo && (
        <Input
          label="유튜브 주소"
          name="videoUrl"
          required
          defaultValue={defaultVideoUrl}
          placeholder="https://www.youtube.com/watch?v=..."
          hint="watch?v= · youtu.be · shorts 주소 모두 가능. 홈 히어로 카드에 썸네일과 재생 버튼이 표시되고, 누르면 모달에서 재생됩니다."
          error={errors.videoUrl}
        />
      )}

      <Input
        label={isVideo ? '대체 이미지 주소' : '이미지 주소'}
        name="imageUrl"
        required={!isVideo}
        defaultValue={defaultImageUrl}
        placeholder="https://... 또는 /images/..."
        hint={isVideo ? '카드 썸네일로 쓰입니다. 비우면 유튜브 기본 썸네일을 씁니다.' : undefined}
        error={errors.imageUrl}
      />
      <Input
        label={isVideo ? '대체 이미지 파일' : '이미지 파일'}
        name="imageFile"
        type="file"
        accept={IMAGE_ACCEPT}
        hint="파일을 올리면 위 주소 대신 업로드한 이미지를 씁니다."
        error={errors.imageFile}
        className="h-auto py-2"
      />
    </fieldset>
  )
}
