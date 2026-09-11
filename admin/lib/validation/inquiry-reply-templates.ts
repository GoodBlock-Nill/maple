import { z } from 'zod'

import { INQUIRY_REPLY_MAX_LENGTH } from '@/lib/validation/inquiries'

/**
 * 답변 템플릿 입력 계약 (`inquiry_reply_templates`, 마이그레이션 20260911000200).
 *
 * 상한은 DB CHECK 와 **같은 숫자**여야 한다. 어긋나면 화면이 통과시킨 값이 저장에서
 * 23514 로 떨어져 운영자는 이유를 알 수 없는 실패를 본다.
 *
 * 본문 상한이 답변 입력칸과 같은 이유는 하나다 — 불러온 문안이 그대로 답변으로
 * 저장된다. 여기가 더 관대하면 "불러왔는데 등록할 수 없는" 템플릿이 만들어진다.
 */

export const INQUIRY_REPLY_TEMPLATE_NAME_MAX = 40
export const INQUIRY_REPLY_TEMPLATE_BODY_MAX = INQUIRY_REPLY_MAX_LENGTH

/** 카테고리 선택의 '공통' 항목 값. 셀렉트는 빈 문자열을 실어 보내므로 그것을 NULL 로 읽는다. */
export const COMMON_CATEGORY_VALUE = ''

/** 화면·문구에서 '공통'을 부르는 이름. 목록 머리글과 셀렉트가 같은 말을 쓰게 한다. */
export const COMMON_CATEGORY_LABEL = '공통(모든 카테고리)'

/** CRLF 정규화 + 앞뒤 공백 제거. 답변 스키마와 같은 규칙이다(줄바꿈만 살아남는다). */
function trimmedText(max: number, requiredMessage: string, tooLongMessage: string) {
  return z
    .string()
    .transform((value) => value.replace(/\r\n?/g, '\n').trim())
    .pipe(z.string().min(1, requiredMessage).max(max, tooLongMessage))
}

export const inquiryReplyTemplateSchema = z.object({
  /* 빈 문자열이 '공통'이다. 별도 플래그를 두면 "카테고리도 있고 공통이기도 한" 상태가
     생긴다(DB 는 category_id IS NULL 하나로 그 규칙을 닫아 둔다). */
  categoryId: z.union([z.literal(COMMON_CATEGORY_VALUE), z.uuid('카테고리를 다시 골라 주세요.')]),
  name: trimmedText(
    INQUIRY_REPLY_TEMPLATE_NAME_MAX,
    '템플릿 이름을 입력해 주세요.',
    `이름은 ${INQUIRY_REPLY_TEMPLATE_NAME_MAX}자를 넘을 수 없습니다.`,
  ),
  body: trimmedText(
    INQUIRY_REPLY_TEMPLATE_BODY_MAX,
    '템플릿 내용을 입력해 주세요.',
    `내용은 ${INQUIRY_REPLY_TEMPLATE_BODY_MAX}자를 넘을 수 없습니다.`,
  ),
  isActive: z.boolean(),
})

export type InquiryReplyTemplateInput = z.infer<typeof inquiryReplyTemplateSchema>

/** 정렬 저장 요청의 본문. 한 카테고리 묶음의 순서를 그대로 0..n-1 로 다시 쓴다. */
export const inquiryReplyTemplateReorderSchema = z.object({
  ids: z.array(z.uuid()).min(1, '정렬할 항목이 없습니다.'),
})

/** 폼의 '공통'(빈 문자열) → 저장값 NULL. 두 벌의 "공통"을 만들지 않는다. */
export function toCategoryId(value: string): string | null {
  return value === COMMON_CATEGORY_VALUE ? null : value
}
