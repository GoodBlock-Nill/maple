import { z } from 'zod'

/**
 * 문의 카테고리 입력 계약 (`inquiry_categories`, 마이그레이션 20260910000400).
 *
 * 상한은 DB CHECK 와 **같은 숫자**여야 한다. 어긋나면 화면이 통과시킨 값이 저장에서
 * 23514 로 떨어져 운영자는 이유를 알 수 없는 실패를 본다.
 *
 * 라벨이 곧 `inquiries.category` 에 저장되는 값이라 사실상 식별자처럼 쓰인다. 그래서
 * 라벨 변경은 과거 문의의 재라벨링을 동반하고(`public.update_inquiry_category()`),
 * 코드가 행을 가리킬 때는 라벨이 아니라 `key` 를 쓴다.
 */

export const INQUIRY_CATEGORY_LABEL_MAX = 20
export const INQUIRY_CATEGORY_DESCRIPTION_MAX = 100
export const INQUIRY_CATEGORY_PREFILL_MAX = 2000
export const INQUIRY_CATEGORY_KEY_MAX = 40

/**
 * 세부 문의 유형(`subtypes`). 상한은 DB CHECK(`inquiry_categories_subtypes_shape`,
 * 마이그레이션 20260910000700)와 같은 숫자다.
 *
 * 항목 하나가 그대로 `inquiries.type` 에 저장되고 사용자 폼의 셀렉트에 보인다.
 * 30자를 넘기면 좁은 화면에서 셀렉트가 잘려 사용자가 무엇을 고르는지 알 수 없다.
 */
export const INQUIRY_SUBTYPE_MAX = 30
export const INQUIRY_SUBTYPE_COUNT_MAX = 20

/** DB CHECK(`inquiry_categories_key_shape`)와 같은 모양. */
const KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/

/**
 * 라벨 → key 자동 생성.
 *
 * 라벨은 대부분 한글이라 슬러그로 옮길 라틴 문자가 없다. 억지로 음차하지 않고,
 * 남는 글자가 없으면 무작위 key 를 준다 — key 는 화면에 보이는 값이 아니라 코드가
 * 같은 행을 계속 가리키기 위한 안정 식별자이기 때문이다.
 */
export function toCategoryKey(label: string, fallbackSeed = ''): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, INQUIRY_CATEGORY_KEY_MAX)

  if (KEY_PATTERN.test(slug)) {
    return slug
  }

  const seed = fallbackSeed.replace(/[^a-z0-9]/g, '').slice(0, 8)

  return `c-${seed === '' ? randomSeed() : seed}`
}

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10).padEnd(8, '0')
}

/** CRLF 정규화 + trim. 빈 값을 허용하는 필드에 쓴다(문의 답변의 규칙과 같다). */
function optionalText(max: number, tooLongMessage: string) {
  return z
    .string()
    .transform((value) => value.replace(/\r\n?/g, '\n').trim())
    .pipe(z.string().max(max, tooLongMessage))
}

/**
 * 세부 유형 목록.
 *
 * 폼은 항목마다 `subtypes` 라는 같은 이름으로 싣는다(`formData.getAll`). 빈 칸은
 * 지운 항목이므로 조용히 걷어내고, **중복만은 막는다** — 같은 문구가 두 번 보이는
 * 셀렉트는 사용자가 "무엇이 다른가"를 고민하게 만들고, 관리자도 어느 쪽을 지워야
 * 하는지 알 수 없다.
 */
const subtypesSchema = z
  .array(z.string())
  .transform((values) => values.map((value) => value.trim()).filter((value) => value !== ''))
  .superRefine((values, ctx) => {
    if (values.length > INQUIRY_SUBTYPE_COUNT_MAX) {
      ctx.addIssue({
        code: 'custom',
        message: `세부 유형은 ${INQUIRY_SUBTYPE_COUNT_MAX}개까지 넣을 수 있습니다.`,
      })
    }

    if (values.some((value) => value.length > INQUIRY_SUBTYPE_MAX)) {
      ctx.addIssue({
        code: 'custom',
        message: `세부 유형은 각 ${INQUIRY_SUBTYPE_MAX}자를 넘을 수 없습니다.`,
      })
    }

    if (new Set(values).size !== values.length) {
      ctx.addIssue({ code: 'custom', message: '같은 세부 유형을 두 번 넣을 수 없습니다.' })
    }
  })

export const inquiryCategorySchema = z.object({
  label: z
    .string()
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .min(1, '카테고리 이름을 입력해 주세요.')
        .max(
          INQUIRY_CATEGORY_LABEL_MAX,
          `이름은 ${INQUIRY_CATEGORY_LABEL_MAX}자를 넘을 수 없습니다.`,
        ),
    ),
  description: optionalText(
    INQUIRY_CATEGORY_DESCRIPTION_MAX,
    `설명은 ${INQUIRY_CATEGORY_DESCRIPTION_MAX}자를 넘을 수 없습니다.`,
  ),
  prefill: optionalText(
    INQUIRY_CATEGORY_PREFILL_MAX,
    `프리필은 ${INQUIRY_CATEGORY_PREFILL_MAX}자를 넘을 수 없습니다.`,
  ),
  subtypes: subtypesSchema,
  isActive: z.boolean(),
})

export type InquiryCategoryInput = z.infer<typeof inquiryCategorySchema>

/** 정렬 저장 요청의 본문. 화면이 보여 준 순서를 그대로 0..n-1 로 다시 쓴다. */
export const inquiryCategoryReorderSchema = z.object({
  ids: z.array(z.uuid()).min(1, '정렬할 항목이 없습니다.'),
})

/** 빈 설명은 null 로 저장한다 — "설명 없음"을 빈 문자열과 null 두 벌로 두지 않는다. */
export function toNullableText(value: string): string | null {
  return value === '' ? null : value
}
