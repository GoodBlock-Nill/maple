import { z } from 'zod'

import { URL_MAX_LENGTH } from '@/lib/constants/field-limits'

import type { Enums } from '@/lib/supabase/types'

/**
 * 확률형 아이템(가이드) 스키마.
 *
 * 폼과 CSV 가 같은 규칙을 쓴다. 화면에서 통과한 값이 CSV 로는 반려되면(또는 그
 * 반대면) 운영자가 두 벌의 규칙을 외워야 한다.
 */

/* `satisfies` 로 DB enum(gacha_tab)에 묶어 둔다. 스키마가 바뀌어 값이 사라지면
   `supabase gen types` 를 다시 돌린 순간 여기서 타입 오류가 난다. */
const TAB_VALUES = ['premium', 'cube', 'scroll'] as const satisfies readonly Enums<'gacha_tab'>[]

export const gachaTabSchema = z.enum(TAB_VALUES)

export type GachaTab = z.infer<typeof gachaTabSchema>

export const GACHA_TAB_VALUES: readonly GachaTab[] = TAB_VALUES

/* 라벨은 사용자 사이트(`lib/constants/guide.ts`)와 **글자까지 같아야 한다**.
   운영자가 관리자에서 고른 탭 이름과 사이트에 보이는 탭 이름이 다르면
   "어느 탭에 넣었는지"를 매번 대조해야 한다. */
export const GACHA_TABS: readonly { value: GachaTab; label: string }[] = [
  { value: 'premium', label: '프리미엄 부화기' },
  { value: 'cube', label: '큐브 / 등급업' },
  { value: 'scroll', label: '주문서 부화기' },
]

export const DEFAULT_GACHA_TAB: GachaTab = 'premium'

export function gachaTabLabel(tab: string): string {
  return GACHA_TABS.find((candidate) => candidate.value === tab)?.label ?? tab
}

export function isGachaTab(value: string): value is GachaTab {
  return GACHA_TAB_VALUES.includes(value as GachaTab)
}

/** 확률표의 등급. 사용자 사이트의 `GachaRow['grade']` 와 1:1 이다. */
export const GACHA_GRADES = ['SS', 'S', 'A', 'B', 'C'] as const

/** 공시 확률은 소수 셋째 자리까지다(마이그레이션 numeric(6,3)). */
export const PROBABILITY_DECIMALS = 3

/** 확률 입력칸의 글자수 상한 — 가장 긴 값이 `100.000` 이라 7이다. */
export const PROBABILITY_INPUT_MAX_LENGTH = 7

const DECIMAL_PATTERN = /^\d+(\.\d+)?$/

/**
 * 확률 문자열 → 숫자.
 *
 * `z.coerce.number()` 를 쓰지 않는다. coerce 는 ''(빈 문자열)을 0 으로, '1e3' 을
 * 1000 으로 조용히 바꿔 오타가 그대로 저장된다. 표기부터 검사한 뒤 변환한다.
 */
export const probabilitySchema = z
  .string()
  .trim()
  .min(1, '확률을 입력해 주세요.')
  .refine((value) => DECIMAL_PATTERN.test(value), '확률은 숫자로 입력해 주세요. (예: 1.234)')
  .refine(
    (value) => (value.split('.')[1]?.length ?? 0) <= PROBABILITY_DECIMALS,
    `확률은 소수점 ${PROBABILITY_DECIMALS}자리까지 입력할 수 있습니다.`,
  )
  .transform((value) => Number(value))
  .refine((value) => value >= 0 && value <= 100, '확률은 0 이상 100 이하여야 합니다.')

/** 아이콘은 외부 URL 또는 사용자 사이트의 정적 경로(`/images/...`) 둘 다 받는다. */
export const assetPathSchema = z
  .string()
  .trim()
  /* 표시 제약이 아니라 기술적 상한이다 — Storage 공개 URL 이 ≈150자라 넉넉하다. */
  .max(URL_MAX_LENGTH, `주소는 ${URL_MAX_LENGTH}자를 넘을 수 없습니다.`)
  .refine(
    (value) => value === '' || value.startsWith('/') || /^https?:\/\//.test(value),
    'http(s) URL 이거나 `/` 로 시작하는 경로여야 합니다.',
  )

/** 확률표 한 행의 아이템 이름. 상세 모달 표의 좁은 칸(≈8자/줄)에서 줄바꿈된다. */
export const GACHA_ROW_ITEM_NAME_MAX = 100

/** 확률표 비고. 상세 모달 표의 마지막 칸(≈15자/줄)에서 줄바꿈된다. */
export const GACHA_ROW_NOTE_MAX = 200

/** 카드에 크게 찍히는 아이템 이름. */
export const GACHA_ITEM_NAME_MAX = 120

export const gachaRowSchema = z.object({
  grade: z.enum(GACHA_GRADES),
  itemName: z.string().trim().min(1, '아이템 이름을 입력해 주세요.').max(GACHA_ROW_ITEM_NAME_MAX),
  itemIcon: assetPathSchema,
  /* 확률표의 확률은 표기 그대로 보관한다(사용자 사이트가 "0.05" 를 그대로 그린다).
     합계 검증이 필요해질 수 있어 반올림하지 않는다. */
  probability: z
    .string()
    .trim()
    .refine((value) => DECIMAL_PATTERN.test(value), '확률표의 확률은 숫자여야 합니다.'),
  note: z.string().trim().max(GACHA_ROW_NOTE_MAX).default('-'),
})

export type GachaDetailRow = z.infer<typeof gachaRowSchema>

export const gachaRowsSchema = z.array(gachaRowSchema)

/** 폼의 hidden 필드로 오는 확률표 JSON. 빈 값은 빈 배열로 본다. */
export const gachaRowsJsonSchema = z
  .string()
  .transform((value) => value.trim())
  .transform((value, ctx) => {
    if (value === '') {
      return []
    }

    try {
      return JSON.parse(value) as unknown
    } catch {
      ctx.addIssue({ code: 'custom', message: '확률표를 읽지 못했습니다.' })

      return z.NEVER
    }
  })
  .pipe(gachaRowsSchema)

export const gachaItemSchema = z.object({
  tab: gachaTabSchema,
  name: z
    .string()
    .trim()
    .min(1, '이름을 입력해 주세요.')
    .max(GACHA_ITEM_NAME_MAX, `이름은 ${GACHA_ITEM_NAME_MAX}자를 넘을 수 없습니다.`),
  iconUrl: assetPathSchema,
  probability: probabilitySchema,
  rows: gachaRowsSchema,
  isPublished: z.boolean(),
  /* `datetime-local` 은 타임존이 없는 문자열을 준다. 빈 값이면 지금으로 채운다. */
  publishedAt: z.string().trim(),
})

export type GachaItemInput = z.infer<typeof gachaItemSchema>

/* ---------------------------------------------------------------------------
 * CSV
 * ------------------------------------------------------------------------ */

/**
 * 내보내기/가져오기 열 순서. 내보낸 파일을 그대로 고쳐 다시 올릴 수 있어야 하므로
 * 두 방향이 같은 목록을 쓴다. `id` 가 채워져 있으면 그 행을 수정하고, 비어 있으면
 * (tab, name) 으로 찾아 없을 때만 새로 만든다.
 */
export const GACHA_CSV_HEADERS = [
  'id',
  'tab',
  'name',
  'icon_url',
  'probability',
  'is_published',
  'published_at',
  'rows',
] as const

/** 가져오기에 최소한 있어야 하는 열. */
export const GACHA_CSV_REQUIRED_HEADERS = ['tab', 'name', 'probability'] as const

const BOOLEAN_TRUE = new Set(['true', '1', 'y', 'yes', '공개', 'o'])
const BOOLEAN_FALSE = new Set(['false', '0', 'n', 'no', '비공개', 'x', ''])

export const csvBooleanSchema = z
  .string()
  .trim()
  .transform((value) => value.toLowerCase())
  .refine(
    (value) => BOOLEAN_TRUE.has(value) || BOOLEAN_FALSE.has(value),
    '공개 여부는 true/false 로 입력해 주세요.',
  )
  .transform((value) => BOOLEAN_TRUE.has(value))

/** 빈 값이면 null, 값이 있으면 파싱 가능한 시각이어야 한다. */
export const csvDateSchema = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .refine(
    (value) => value === null || !Number.isNaN(Date.parse(value)),
    '날짜 형식이 올바르지 않습니다. (예: 2026-09-08T10:00:00Z)',
  )
  .transform((value) => (value === null ? null : new Date(value).toISOString()))

export const gachaCsvRowSchema = z.object({
  id: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || z.uuid().safeParse(value).success,
      'id 가 UUID 가 아닙니다.',
    ),
  tab: z
    .string()
    .trim()
    .refine(isGachaTab, `tab 은 ${GACHA_TAB_VALUES.join(' / ')} 중 하나여야 합니다.`),
  name: z.string().trim().min(1, '이름이 비어 있습니다.').max(GACHA_ITEM_NAME_MAX),
  icon_url: assetPathSchema.default(''),
  probability: probabilitySchema,
  is_published: csvBooleanSchema.default(true),
  published_at: csvDateSchema.default(null),
  rows: gachaRowsJsonSchema.default([]),
})

export type GachaCsvRow = z.infer<typeof gachaCsvRowSchema>
