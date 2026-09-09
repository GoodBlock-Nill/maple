import { z } from 'zod'

import { parseYoutubeId } from '@/lib/utils/youtube'
import { kstLocalToIso, optionalLinkSchema, optionalTextSchema } from '@/lib/validation/settings'

/**
 * 히어로 배너 스키마 · 행 변환 · 순서 계산.
 *
 * 사이트 설정과 같은 화면에 있지만 규칙이 따로 논다 — 배너는 종류(이미지 · 유튜브)에
 * 따라 필수 항목이 바뀌고, 목록 순서까지 다룬다. 그래서 파일을 나눠 둔다.
 * 공통 문자열 스키마와 일시 변환은 `./settings` 에서 가져온다.
 */

/** 배너에 담을 수 있는 미디어. DB 의 `hero_banners_media_type` 제약과 같은 목록이다. */
export const HERO_MEDIA_TYPES = ['image', 'youtube'] as const

export type HeroMediaType = (typeof HERO_MEDIA_TYPES)[number]

/** 이미지 주소는 Storage 공개 URL 이거나 사용자 사이트의 정적 경로다. */
const heroImageUrlSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || value.startsWith('/') || /^https?:\/\/\S+$/.test(value),
    'http(s) 주소이거나 `/` 로 시작하는 경로여야 합니다.',
  )

/* 폼이 값을 보내지 않았을 때(미디어 유형이 없던 시절의 저장 요청)는 이미지로 본다. */
const heroMediaTypeSchema = z
  .string()
  .trim()
  .transform((value) => (value === '' ? 'image' : value))
  .pipe(z.enum(HERO_MEDIA_TYPES, { message: '미디어 유형을 다시 선택해 주세요.' }))

const heroBannerFieldsSchema = z.object({
  title: z.string().trim().min(1, '제목을 입력해 주세요.').max(100),
  subtitle: optionalTextSchema(200),
  mediaType: heroMediaTypeSchema,
  imageUrl: heroImageUrlSchema,
  videoUrl: z.string().trim().max(300, '주소가 너무 깁니다.'),
  linkUrl: optionalLinkSchema,
  ctaLabel: optionalTextSchema(30),
  sortOrder: z
    .string()
    .trim()
    .refine((value) => /^-?\d+$/.test(value), '정렬 순서는 정수로 입력해 주세요.')
    .transform((value) => Number.parseInt(value, 10)),
  isActive: z.boolean(),
  startsAt: z.string().trim().transform(kstLocalToIso),
  endsAt: z.string().trim().transform(kstLocalToIso),
})

export const heroBannerSchema = heroBannerFieldsSchema
  /* DB 의 hero_banners_period 제약과 같은 규칙. 여기서 먼저 거르면 운영자가
     Postgres 오류 문구 대신 필드 옆의 안내를 본다. */
  .refine(
    (value) => value.startsAt === null || value.endsAt === null || value.startsAt < value.endsAt,
    { path: ['endsAt'], message: '종료 시각은 시작 시각보다 뒤여야 합니다.' },
  )
  /* DB 의 hero_banners_media_shape 제약과 같은 규칙 — 종류에 맞는 주소가 반드시
     있어야 한다. 영상 배너의 이미지는 포스터라서 없어도 된다. */
  .superRefine((value, ctx) => {
    if (value.mediaType === 'image' && value.imageUrl === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['imageUrl'],
        message: '이미지를 등록하거나 주소를 입력해 주세요.',
      })
    }

    if (value.mediaType === 'youtube' && parseYoutubeId(value.videoUrl) === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['videoUrl'],
        message:
          value.videoUrl === ''
            ? '유튜브 주소를 입력해 주세요.'
            : '유튜브 영상 주소를 알아볼 수 없습니다. 주소창의 값을 그대로 붙여 넣어 주세요.',
      })
    }
  })
  .transform((value) => ({
    ...value,
    imageUrl: value.imageUrl === '' ? null : value.imageUrl,
    /* 이미지 배너로 되돌린 뒤에도 옛 영상이 남아 있으면, 다음에 유형만 바꿨을 때
       엉뚱한 영상이 되살아난다. 종류에 맞지 않는 값은 저장 단계에서 지운다. */
    videoUrl: value.mediaType === 'youtube' ? value.videoUrl : null,
  }))

export type HeroBannerInput = z.infer<typeof heroBannerSchema>

/* imageUrl 은 파일 업로드 결과로 덮어써야 해서 액션이 따로 넣는다. */
export const HERO_BANNER_TEXT_FIELDS = [
  'title',
  'subtitle',
  'mediaType',
  'videoUrl',
  'linkUrl',
  'ctaLabel',
  'sortOrder',
  'startsAt',
  'endsAt',
] as const

/** 검증을 통과한 입력 → `hero_banners` 행. */
export function toHeroBannerRow(input: HeroBannerInput) {
  return {
    title: input.title,
    subtitle: input.subtitle,
    media_type: input.mediaType,
    image_url: input.imageUrl,
    video_url: input.videoUrl,
    link_url: input.linkUrl,
    cta_label: input.ctaLabel,
    sort_order: input.sortOrder,
    is_active: input.isActive,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
  }
}

/**
 * 목록에서 한 칸 이동한 결과 순서.
 *
 * 이웃과 `sort_order` 를 맞바꾸지 않고 배열을 다시 배열한다. 초기 데이터는
 * `sort_order` 가 전부 0(기본값)이라 맞바꾸기로는 아무 일도 일어나지 않는다.
 */
export function movedOrder<T extends { id: string }>(
  items: readonly T[],
  id: string,
  direction: 'up' | 'down',
): readonly T[] | null {
  const index = items.findIndex((item) => item.id === id)
  const target = index + (direction === 'up' ? -1 : 1)

  if (index === -1 || target < 0 || target >= items.length) {
    return null
  }

  const ordered = [...items]
  const [moved] = ordered.splice(index, 1)

  if (moved === undefined) {
    return null
  }

  ordered.splice(target, 0, moved)

  return ordered
}
