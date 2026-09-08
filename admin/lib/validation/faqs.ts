import { z } from 'zod'

/* 여러 줄 평문 정규화(CRLF→LF)는 문의 답변과 규칙이 같다. 규칙을 두 벌로 두면
   한쪽만 고쳐지므로 문의 쪽 구현을 그대로 빌려 쓴다. */
import { plainTextField } from '@/lib/validation/inquiries'

import type { Enums } from '@/lib/supabase/types'

/**
 * FAQ 입력 계약 · 정렬 헬퍼.
 *
 * 답변은 **평문**이다. 사용자 사이트의 아코디언(`components/support/FaqAccordion`)이
 * 답변을 `<p>{item.answer}</p>` 로 그리므로 마크다운·HTML 을 넣어도 해석되지 않고
 * 원문 기호가 그대로 노출된다. 그래서 관리자 폼도 textarea + 미리보기로 둔다.
 */

export type FaqCategory = Enums<'faq_category'>

export type FaqCategoryOption = {
  value: FaqCategory
  label: string
}

/**
 * 사용자 사이트(`lib/constants/support.ts`)의 표시 순서·문구와 일치시킨다.
 *
 * 값 목록을 튜플로 두는 이유: `z.enum()` 은 최소 한 개가 보장된 튜플을 요구한다.
 * `map()` 으로 만든 배열은 그 보장을 잃어 단언(as)이 필요해진다.
 */
export const FAQ_CATEGORY_VALUES = [
  'notice',
  'account',
  'payment',
  'bug',
  'etc',
] as const satisfies readonly FaqCategory[]

export const FAQ_CATEGORY_LABELS: Record<FaqCategory, string> = {
  notice: '공지사항',
  account: '계정',
  payment: '결제',
  bug: '버그',
  etc: '기타',
}

export const FAQ_CATEGORIES: readonly FaqCategoryOption[] = FAQ_CATEGORY_VALUES.map((value) => ({
  value,
  label: FAQ_CATEGORY_LABELS[value],
}))

export function isFaqCategory(value: string | null | undefined): value is FaqCategory {
  return typeof value === 'string' && (FAQ_CATEGORY_VALUES as readonly string[]).includes(value)
}

export const FAQ_QUESTION_MAX_LENGTH = 200
export const FAQ_ANSWER_MAX_LENGTH = 2000

export const faqSchema = z.object({
  category: z.enum(FAQ_CATEGORY_VALUES),
  question: plainTextField(
    FAQ_QUESTION_MAX_LENGTH,
    '질문을 입력해 주세요.',
    `질문은 ${FAQ_QUESTION_MAX_LENGTH}자를 넘을 수 없습니다.`,
  ),
  answer: plainTextField(
    FAQ_ANSWER_MAX_LENGTH,
    '답변을 입력해 주세요.',
    `답변은 ${FAQ_ANSWER_MAX_LENGTH}자를 넘을 수 없습니다.`,
  ),
  isPublished: z.boolean(),
})

export type FaqInput = z.infer<typeof faqSchema>

/* -------------------------------------------------------------------------
 * 정렬
 * ---------------------------------------------------------------------- */

export type FaqOrderItem = {
  id: string
  sortOrder: number
}

export type FaqMoveDirection = 'up' | 'down'

/**
 * 한 칸 위/아래로 옮긴 뒤 `sort_order` 를 0부터 다시 매긴다.
 *
 * 자리를 바꾼 두 행의 값만 맞바꾸면 기존 데이터에 중복·구멍(0,0,5,5)이 있을 때
 * 순서가 그대로 남는다. 화면에 보이는 배열을 그대로 0..n-1 로 다시 쓰는 편이
 * 결과가 눈에 보이는 것과 항상 같다.
 *
 * 끝에서 더 밀면 원본을 그대로 돌려준다(호출부는 저장할 변경이 없다고 판단한다).
 */
export function moveFaqOrder(
  items: readonly FaqOrderItem[],
  id: string,
  direction: FaqMoveDirection,
): readonly FaqOrderItem[] {
  const index = items.findIndex((item) => item.id === id)
  const target = direction === 'up' ? index - 1 : index + 1

  if (index === -1 || target < 0 || target >= items.length) {
    return items
  }

  const next = [...items]
  const moved = next[index]
  const swapped = next[target]

  if (moved === undefined || swapped === undefined) {
    return items
  }

  next[index] = swapped
  next[target] = moved

  return normalizeFaqOrder(next.map((item) => item.id))
}

/** 화면에 보이는 순서를 그대로 `sort_order` 로 굳힌다. */
export function normalizeFaqOrder(ids: readonly string[]): readonly FaqOrderItem[] {
  return ids.map((id, index) => ({ id, sortOrder: index }))
}

/** 저장할 값이 있는지(= 순서가 실제로 바뀌었는지) 판정한다. */
export function hasFaqOrderChanged(
  original: readonly FaqOrderItem[],
  next: readonly FaqOrderItem[],
): boolean {
  if (original.length !== next.length) {
    return true
  }

  return original.some((item, index) => next[index]?.id !== item.id)
}

/** 정렬 저장 요청의 본문. 카테고리 안에서만 순서를 다시 매긴다. */
export const faqReorderSchema = z.object({
  category: z.enum(FAQ_CATEGORY_VALUES),
  ids: z.array(z.uuid()).min(1, '정렬할 항목이 없습니다.'),
})
