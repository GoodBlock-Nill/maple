import { normalizeCRLF } from '@/lib/validation/inquiry'

import type { InquiryCategoryOption } from '@/types/domain'

/**
 * 카테고리 프리필 판정 (`docs/1on1.md`).
 *
 * 규칙은 하나다 — **카테고리를 바꾸면 그 카테고리의 양식으로 갈아 끼운다.** 다만
 * 사용자가 직접 쓴 내용까지 말없이 지우면 문의를 다시 쓰게 만든다. 그래서 "지울
 * 것이 있는가"를 여기서 판정하고, 있을 때만 화면이 확인 모달을 세운다.
 *
 * React 밖의 순수 함수로 둔 이유는 이 판정이 폼의 파괴적 동작을 결정하기 때문이다 —
 * 렌더링 없이 그대로 테스트할 수 있어야 한다.
 */

/** 비교 전 정규화. 브라우저가 넣는 CR 과 앞뒤 공백만 걷어 낸다. */
function canonical(text: string): string {
  return normalizeCRLF(text).trim()
}

export function findInquiryCategory(
  categories: readonly InquiryCategoryOption[],
  label: string,
): InquiryCategoryOption | undefined {
  return categories.find((category) => category.label === label)
}

/**
 * 지금 내용을 물어보지 않고 갈아 끼워도 되는가.
 *
 * 비어 있거나, 어느 카테고리의 양식 원문 그대로면 잃을 것이 없다. 두 번째 조건이
 * 필요한 이유는 수정 화면 때문이다 — 접수 당시 양식을 그대로 둔 문의를 열면
 * 내용은 "사용자가 쓴 값"으로 보이지만 실제로는 아무것도 쓰지 않은 상태다.
 */
export function isDiscardableContent(
  content: string,
  categories: readonly InquiryCategoryOption[],
): boolean {
  const current = canonical(content)

  if (current === '') {
    return true
  }

  return categories.some(
    (category) => category.prefill !== '' && canonical(category.prefill) === current,
  )
}

/**
 * 목록에 없는 라벨(비활성화됐거나 이름이 바뀐 옛 카테고리)을 뒤에 붙인다.
 *
 * 수정 화면에서만 쓴다. 붙이지 않으면 셀렉트가 저장된 값을 고를 수 없어, 본문
 * 오타 하나 고치려던 사용자가 카테고리부터 다시 정해야 한다.
 */
export function withLegacyCategory(
  categories: readonly InquiryCategoryOption[],
  label: string,
): readonly InquiryCategoryOption[] {
  if (label === '' || findInquiryCategory(categories, label) !== undefined) {
    return categories
  }

  return [...categories, { key: `legacy:${label}`, label, description: null, prefill: '' }]
}
