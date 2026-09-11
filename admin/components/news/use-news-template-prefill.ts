'use client'

import { useCallback, useState } from 'react'

import {
  decideNewsTemplateApply,
  findNewsTemplate,
  newsTemplatePatch,
  type NewsTemplate,
} from '@/lib/utils/news-template-prefill'

/**
 * 카테고리 선택 ↔ 본문 템플릿의 상태 기계.
 *
 * 판정 규칙은 `lib/utils/news-template-prefill.ts` 가 쥐고 있고(순수 함수 · 테스트로 고정),
 * 여기서는 그 결정을 폼 상태로 옮기기만 한다. 흐름은 셋뿐이다.
 *
 *   고른다 → 지울 것이 없다 → 곧바로 채운다
 *   고른다 → 쓰던 내용이 있다 → `pendingCategory` 를 세우고 화면이 확인 모달을 연다
 *   확인 → 갈아 끼운다 / 취소 → 본문은 그대로 둔다(카테고리 변경만 남는다)
 *
 * **본문을 상위 상태로 들고 있지 않는 이유.** 에디터를 제어 컴포넌트로 만들면 한 글자마다
 * 폼이 리렌더되고 ProseMirror 가 새 문서를 받아 한글 조합이 끊긴다(`PostEditor` 주석).
 * 그래서 지금 본문은 **판정이 필요한 순간에만** 화면이 읽어 넘겨 주고(`readEditorBody`),
 * 갈아 끼울 때만 `bodyKey` 를 올려 에디터를 새 초기값으로 다시 마운트한다.
 * 확인 모달을 거친 뒤에는 본문을 다시 읽지 않는다 — 덮어쓰기로 이미 결론이 났다.
 *
 * 취소했을 때 카테고리를 되돌리지 않는 것은 의도된 선택이다. 운영자가 바꾸려던 것은 글의
 * 카테고리이고, 템플릿은 그에 딸린 편의다 — 확인을 거절했다고 카테고리까지 되돌리면 방금 한
 * 조작이 통째로 사라진 것처럼 보인다.
 */

export type NewsTemplatePrefill = {
  category: string
  title: string
  summary: string
  /** 에디터에 넘길 초기 본문. `bodyKey` 와 짝으로만 바뀐다. */
  body: string
  bodyKey: number
  /** 확인 대기 중인 카테고리 라벨. null 이면 모달을 닫는다. */
  pendingLabel: string | null
  /** 지금 카테고리에 쓸 수 있는 템플릿이 있는가('템플릿 불러오기' 버튼의 노출 조건). */
  hasTemplate: boolean
  /** @param currentBody 지금 에디터에 있는 본문. 화면이 DOM 에서 읽어 넘긴다. */
  selectCategory: (value: string, currentBody: string) => void
  setTitle: (value: string) => void
  setSummary: (value: string) => void
  /** 수정 화면의 '템플릿 불러오기'. 자동 적용은 하지 않고 이 버튼으로만 들어온다. */
  loadTemplate: (currentBody: string) => void
  confirmPending: () => void
  cancelPending: () => void
}

export function useNewsTemplatePrefill({
  templates,
  categoryLabels,
  initial,
  /** 수정 화면인가. 기존 글에서는 카테고리를 바꿔도 템플릿을 자동 적용하지 않는다. */
  isEdit,
}: {
  templates: readonly NewsTemplate[]
  categoryLabels: ReadonlyMap<string, string>
  initial: { category: string; title: string; summary: string; body: string }
  isEdit: boolean
}): NewsTemplatePrefill {
  const [category, setCategory] = useState(initial.category)
  const [title, setTitle] = useState(initial.title)
  const [summary, setSummary] = useState(initial.summary)
  const [body, setBody] = useState(initial.body)
  const [bodyKey, setBodyKey] = useState(0)
  /* 직전에 이 폼이 채워 넣은 템플릿 본문. 손대지 않은 양식은 "쓴 내용"이 아니라서
     확인 없이 갈아 끼운다. */
  const [appliedBody, setAppliedBody] = useState<string | null>(null)
  const [pendingCategory, setPendingCategory] = useState<string | null>(null)

  const apply = useCallback(
    (template: NewsTemplate) => {
      const patch = newsTemplatePatch(template, { title, summary })

      if (patch.title !== null) {
        setTitle(patch.title)
      }

      if (patch.summary !== null) {
        setSummary(patch.summary)
      }

      if (patch.body !== null) {
        setBody(patch.body)
        // 에디터는 초기값으로만 본문을 받는다. 새 값을 보이려면 다시 마운트해야 한다.
        setBodyKey((current) => current + 1)
        setAppliedBody(patch.body)
      }

      setPendingCategory(null)
    },
    [summary, title],
  )

  const run = useCallback(
    (targetCategory: string, currentBody: string) => {
      const template = findNewsTemplate(templates, targetCategory)
      const decision = decideNewsTemplateApply({ template, currentBody, appliedBody })

      if (decision === 'apply' && template !== null) {
        apply(template)

        return
      }

      if (decision === 'confirm') {
        setPendingCategory(targetCategory)
      }
    },
    [appliedBody, apply, templates],
  )

  const selectCategory = useCallback(
    (value: string, currentBody: string) => {
      setCategory(value)

      /* 기존 글은 자동 적용하지 않는다 — 발행된 글의 본문이 카테고리 한 번 바꿨다고
         양식으로 덮이면 복구할 길이 없다. 수정 화면에는 '템플릿 불러오기' 가 있다. */
      if (isEdit || value === '') {
        return
      }

      run(value, currentBody)
    },
    [isEdit, run],
  )

  const loadTemplate = useCallback(
    (currentBody: string) => {
      if (category !== '') {
        run(category, currentBody)
      }
    },
    [category, run],
  )

  const confirmPending = useCallback(() => {
    const template = pendingCategory === null ? null : findNewsTemplate(templates, pendingCategory)

    if (template === null) {
      setPendingCategory(null)

      return
    }

    apply(template)
  }, [apply, pendingCategory, templates])

  const cancelPending = useCallback(() => {
    setPendingCategory(null)
  }, [])

  const current = findNewsTemplate(templates, category)

  return {
    category,
    title,
    summary,
    body,
    bodyKey,
    pendingLabel:
      pendingCategory === null ? null : (categoryLabels.get(pendingCategory) ?? pendingCategory),
    hasTemplate: current !== null && current.isActive,
    selectCategory,
    setTitle,
    setSummary,
    loadTemplate,
    confirmPending,
    cancelPending,
  }
}
