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
