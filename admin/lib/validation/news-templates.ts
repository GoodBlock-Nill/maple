import { z } from 'zod'

import {
  NEWS_CATEGORY_KEYS,
  NEWS_SUMMARY_MAX,
  NEWS_TITLE_MAX,
  type NewsCategoryKey,
} from '@/lib/constants/news'

/**
 * 뉴스 카테고리 템플릿의 입력 계약 (`news_category_templates`, 마이그레이션 20260911000100).
 *
 * **상한이 글 필드와 같은 숫자인 것이 핵심이다.** 템플릿은 그대로 새 글 폼에 들어가므로,
 * 여기가 더 관대하면 "불러왔는데 글로는 저장할 수 없는" 문안이 만들어진다. 그래서
 * 제목은 `NEWS_TITLE_MAX`, 요약은 `NEWS_SUMMARY_MAX` 를 그대로 쓴다(DB CHECK 도 같은 값).
 *
 * 본문만 별도 상한이다 — `posts.content` 에는 길이 제약이 없지만, 템플릿은 "채워 넣을
 * 뼈대"라 한 편의 완성된 글보다 길 이유가 없다. 20000자를 넘기는 값은 붙여넣기 사고에
 * 가깝다.
 */

export const NEWS_TEMPLATE_TITLE_MAX = NEWS_TITLE_MAX
export const NEWS_TEMPLATE_SUMMARY_MAX = NEWS_SUMMARY_MAX
export const NEWS_TEMPLATE_BODY_MAX = 20_000

/** 상한만 보는 선택 입력. CRLF 는 LF 로 눌러 저장한다(에디터·DB 가 한 모양만 본다). */
function optionalText(max: number, tooLongMessage: string) {
  return z
    .string()
    .transform((value) => value.replace(/\r\n?/gu, '\n').trim())
    .pipe(z.string().max(max, tooLongMessage))
}

export const newsTemplateSchema = z.object({
  category: z.enum(NEWS_CATEGORY_KEYS, { message: '카테고리를 선택해 주세요.' }),
  title: optionalText(
    NEWS_TEMPLATE_TITLE_MAX,
    `제목 템플릿은 ${NEWS_TEMPLATE_TITLE_MAX}자를 넘을 수 없습니다.`,
  ),
  summary: optionalText(
    NEWS_TEMPLATE_SUMMARY_MAX,
    `요약 템플릿은 ${NEWS_TEMPLATE_SUMMARY_MAX}자를 넘을 수 없습니다.`,
  ),
  /* 본문이 비어 있어도 저장한다 — 제목만 정해 두고 본문은 매번 새로 쓰는 카테고리가 있다.
     "쓴 것이 통째로 지워지는" 경우(정제기가 전부 걷어낸 입력)는 액션이 따로 걸러낸다. */
  body: optionalText(
    NEWS_TEMPLATE_BODY_MAX,
    `본문 템플릿은 ${NEWS_TEMPLATE_BODY_MAX.toLocaleString('ko-KR')}자를 넘을 수 없습니다.`,
  ),
  isActive: z.boolean(),
})

export type NewsTemplateInput = z.infer<typeof newsTemplateSchema>

/** 되돌리기·조회처럼 카테고리 하나만 받는 입력. */
export const newsTemplateCategorySchema = z.object({
  category: z.enum(NEWS_CATEGORY_KEYS, { message: '카테고리를 선택해 주세요.' }),
})

/** 라우트 파라미터(`/news/templates/[category]`)를 카테고리 키로 좁힌다. 모르면 null. */
export function parseNewsTemplateCategory(value: string): NewsCategoryKey | null {
  const parsed = newsTemplateCategorySchema.safeParse({ category: value })

  return parsed.success ? parsed.data.category : null
}
