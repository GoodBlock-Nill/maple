/**
 * 카테고리 템플릿을 새 글 폼에 얹을 때의 판정 — 순수 함수만 모았다.
 *
 * 화면(`NewsForm`)은 이 판정을 읽어 "그냥 채운다 / 확인을 받는다 / 아무 일도 하지 않는다"
 * 셋 중 하나를 한다. 규칙을 컴포넌트 안에 두지 않는 이유는 이 판정이 **내용을 지울 수도
 * 있는** 결정이기 때문이다. 테스트로 고정해 두면 폼이 바뀌어도 규칙은 흔들리지 않는다.
 *
 * 규칙
 *   1. 템플릿이 없거나 꺼져 있으면 → `none`. 카테고리를 골라도 아무 일도 일어나지 않는다.
 *   2. 본문 템플릿이 비어 있으면 → `apply`. 지워질 본문이 없으니 물을 것도 없다
 *      (제목·요약만 비어 있는 칸에 채운다).
 *   3. 본문이 비어 있으면 → `apply`.
 *   4. 본문이 **직전에 적용한 템플릿 그대로**면 → `apply`. 운영자가 쓴 글이 아니라
 *      직전 카테고리의 양식이므로 잃을 것이 없다(카테고리를 연달아 바꿔 보는 흔한 동작).
 *   5. 그 밖에는 → `confirm`. 운영자가 쓴 내용이 남아 있다.
 *
 * 제목·요약은 **비어 있을 때만** 채운다. 직접 쓴 제목을 카테고리 변경이 덮으면, 운영자는
 * 자기가 지우지 않은 문장이 사라지는 것을 본다.
 */

export type NewsTemplate = {
  categoryKey: string
  title: string
  summary: string
  /** Tiptap HTML. 빈 템플릿은 빈 문자열이다. */
  body: string
  isActive: boolean
}

export type NewsTemplateDecision = 'none' | 'apply' | 'confirm'

/** 폼에 실제로 써 넣을 값. `null` 은 "그대로 둔다"는 뜻이다. */
export type NewsTemplatePatch = {
  title: string | null
  summary: string | null
  body: string | null
}

/**
 * 본문이 "빈 것과 다름없는가".
 *
 * 에디터는 빈 문서를 빈 문자열로 내보내지만, 저장된 글을 열면 `<p></p>` 처럼 눈에
 * 보이는 글자가 없는 마크업이 올 수 있다. 반대로 **이미지·영상만 있는 본문은 글자가
 * 없어도 비어 있지 않다** — 텍스트만 세면 운영자가 붙여 넣은 이미지를 말없이 지운다.
 */
export function isBlankPostHtml(html: string): boolean {
  if (/<img|data-video=/iu.test(html)) {
    return false
  }

  return (
    html
      .replace(/<[^>]*>/gu, '')
      .replace(/&nbsp;/gu, ' ')
      .trim() === ''
  )
}

function hasNothingToFill(template: NewsTemplate): boolean {
  return template.title === '' && template.summary === '' && template.body === ''
}

/**
 * 이 템플릿을 지금 적용해도 되는가.
 *
 * @param currentBody 지금 에디터에 있는 본문(HTML).
 * @param appliedBody 직전에 이 폼이 채워 넣은 템플릿 본문. 없으면 null.
 */
export function decideNewsTemplateApply({
  template,
  currentBody,
  appliedBody,
}: {
  template: NewsTemplate | null
  currentBody: string
  appliedBody: string | null
}): NewsTemplateDecision {
  if (template === null || !template.isActive || hasNothingToFill(template)) {
    return 'none'
  }

  if (template.body === '' || isBlankPostHtml(currentBody)) {
    return 'apply'
  }

  return appliedBody !== null && currentBody.trim() === appliedBody.trim() ? 'apply' : 'confirm'
}

/** 템플릿 → 폼에 써 넣을 값. 제목·요약은 비어 있는 칸에만 들어간다. */
export function newsTemplatePatch(
  template: NewsTemplate,
  current: { title: string; summary: string },
): NewsTemplatePatch {
  return {
    title: current.title.trim() === '' && template.title !== '' ? template.title : null,
    summary: current.summary.trim() === '' && template.summary !== '' ? template.summary : null,
    body: template.body === '' ? null : template.body,
  }
}

/** 카테고리 키 → 템플릿. 목록에 없으면 null(새 카테고리가 추가돼도 폼이 깨지지 않는다). */
export function findNewsTemplate(
  templates: readonly NewsTemplate[],
  categoryKey: string,
): NewsTemplate | null {
  return templates.find((template) => template.categoryKey === categoryKey) ?? null
}
