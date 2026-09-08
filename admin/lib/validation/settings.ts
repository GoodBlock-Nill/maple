import { z } from 'zod'

/**
 * 사이트 설정 · 히어로 배너 스키마.
 *
 * 값이 비어 있는 것과 잘못된 것을 구분한다. 관리자 화면의 설정은 대부분 선택
 * 항목이라 빈 문자열은 "설정하지 않음"(null)으로 저장하고, 값이 들어왔을 때만
 * 형식을 검사한다. 빈 값을 반려하면 항목 하나를 지우는 방법이 없어진다.
 */

/** 비어 있으면 null, 값이 있으면 http(s) 절대 URL 이어야 한다. */
export const optionalUrlSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || /^https?:\/\/\S+$/.test(value),
    'http(s) 로 시작하는 주소여야 합니다.',
  )
  .transform((value) => (value === '' ? null : value))

/** 링크는 사이트 내부 경로(`/news`)도 허용한다. */
export const optionalLinkSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || value.startsWith('/') || /^https?:\/\/\S+$/.test(value),
    'http(s) 주소이거나 `/` 로 시작하는 경로여야 합니다.',
  )
  .transform((value) => (value === '' ? null : value))

export const optionalEmailSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || z.email().safeParse(value).success,
    '이메일 형식이 올바르지 않습니다.',
  )
  .transform((value) => (value === '' ? null : value))

const optionalTextSchema = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max}자를 넘을 수 없습니다.`)
    .transform((value) => (value === '' ? null : value))

export const siteSettingsSchema = z.object({
  gameName: z.string().trim().min(1, '사이트 이름을 입력해 주세요.').max(50),
  worldId: optionalTextSchema(50),
  discordUrl: optionalUrlSchema,
  youtubeUrl: optionalUrlSchema,
  contactEmail: optionalEmailSchema,
  ipNotice: optionalTextSchema(500),
  copyright: optionalTextSchema(200),
  creatorName: optionalTextSchema(50),
  creatorSlogan: optionalTextSchema(200),
  /* 문단 구분은 빈 줄 두 개(마이그레이션 주석). 줄바꿈을 그대로 보존해야 하므로
     trim 은 앞뒤만 하고 내부는 손대지 않는다. */
  creatorIntro: optionalTextSchema(4000),
  creatorPhotoUrl: optionalLinkSchema,
})

export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>

/* 폼이 보내는 문자열 필드 이름. 스키마 키와 1:1 이라 여기 두고 서버 액션이
   그대로 읽는다(파일·체크박스는 문자열이 아니라 따로 다룬다). */
export const SITE_SETTINGS_TEXT_FIELDS = [
  'gameName',
  'worldId',
  'discordUrl',
  'youtubeUrl',
  'contactEmail',
  'ipNotice',
  'copyright',
  'creatorName',
  'creatorSlogan',
  'creatorIntro',
] as const

export const heroBannerSchema = z
  .object({
    title: z.string().trim().min(1, '제목을 입력해 주세요.').max(100),
    subtitle: optionalTextSchema(200),
    imageUrl: z
      .string()
      .trim()
      .min(1, '이미지를 등록하거나 주소를 입력해 주세요.')
      .refine(
        (value) => value.startsWith('/') || /^https?:\/\/\S+$/.test(value),
        'http(s) 주소이거나 `/` 로 시작하는 경로여야 합니다.',
      ),
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
  /* DB 의 hero_banners_period 제약과 같은 규칙. 여기서 먼저 거르면 운영자가
     Postgres 오류 문구 대신 필드 옆의 안내를 본다. */
  .refine(
    (value) => value.startsAt === null || value.endsAt === null || value.startsAt < value.endsAt,
    { path: ['endsAt'], message: '종료 시각은 시작 시각보다 뒤여야 합니다.' },
  )

export type HeroBannerInput = z.infer<typeof heroBannerSchema>

export const HERO_BANNER_TEXT_FIELDS = [
  'title',
  'subtitle',
  'linkUrl',
  'ctaLabel',
  'sortOrder',
  'startsAt',
  'endsAt',
] as const

/* ---------------------------------------------------------------------------
 * 일시 입력(datetime-local) ↔ ISO
 *
 * 관리자 화면의 모든 일시는 한국 시간(KST) 벽시계로 다룬다(lib/utils/format-date.ts
 * 와 같은 규약). `new Date(value)` 에 맡기면 서버는 UTC, 브라우저는 로컬 타임존으로
 * 해석해 저장값이 9시간씩 어긋난다.
 * ------------------------------------------------------------------------ */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** ISO → `2026-09-08T19:00` (KST). 입력 컨트롤의 value 로 쓴다. */
export function kstDateTimeLocal(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === '') {
    return ''
  }

  const shifted = new Date(new Date(iso).getTime() + KST_OFFSET_MS)

  if (Number.isNaN(shifted.getTime())) {
    return ''
  }

  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
}

/** `2026-09-08T19:00`(KST) → ISO. 빈 값은 null, 형식이 틀리면 null. */
export function kstLocalToIso(value: string): string | null {
  const trimmed = value.trim()

  if (trimmed === '') {
    return null
  }

  /* 끝까지 고정한다. 접두사만 맞춰 보면 "2026-04-16T10:00:00Z" 처럼 타임존이
     붙은 값까지 벽시계로 오해해 9시간을 두 번 밀어 버린다. */
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(:\d{2}(\.\d+)?)?$/.exec(trimmed)

  if (match === null) {
    // 이미 ISO(Z 포함)로 들어온 값은 그대로 통과시킨다 — CSV 가져오기 경로.
    const parsed = Date.parse(trimmed)

    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString()
  }

  const [, year, month, day, hour, minute] = match
  const utcMs = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))

  return new Date(utcMs - KST_OFFSET_MS).toISOString()
}

/* ---------------------------------------------------------------------------
 * 업로드 · DB 행 변환
 * ------------------------------------------------------------------------ */

/**
 * public-assets 버킷의 `allowed_mime_types` 와 같은 목록.
 * 아이콘·크리에이터 사진·배너가 모두 이 규칙을 쓰므로 한곳에 둔다.
 */
export const PUBLIC_ASSET_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
}

export const ASSET_TYPE_ERROR = 'PNG · JPG · WEBP · GIF · SVG 만 올릴 수 있습니다.'

/** 검증을 통과한 입력 → `site_settings` 행. */
export function toSiteSettingsRow(input: SiteSettingsInput) {
  return {
    game_name: input.gameName,
    world_id: input.worldId,
    discord_url: input.discordUrl,
    youtube_url: input.youtubeUrl,
    contact_email: input.contactEmail,
    ip_notice: input.ipNotice,
    copyright: input.copyright,
    creator_name: input.creatorName,
    creator_slogan: input.creatorSlogan,
    creator_intro: input.creatorIntro,
    creator_photo_url: input.creatorPhotoUrl,
  }
}

/** 검증을 통과한 입력 → `hero_banners` 행. */
export function toHeroBannerRow(input: HeroBannerInput) {
  return {
    title: input.title,
    subtitle: input.subtitle,
    image_url: input.imageUrl,
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
