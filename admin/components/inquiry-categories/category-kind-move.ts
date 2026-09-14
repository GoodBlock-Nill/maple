import { INQUIRY_KIND_MAP } from '@/lib/constants/inquiry-kind'

import type { InquiryKind } from '@/lib/constants/inquiry-kind'

/**
 * 카테고리의 창구(kind)를 옮기는 저장 — 확인을 세울지와 그때 보여 줄 문구.
 *
 * 컴포넌트에서 떼어 낸 이유는 이것이 **판단**이기 때문이다. "언제 묻는가"와 "무엇을
 * 말해 주는가"는 화면 구조와 무관하게 고정되어야 하고, 그 규칙만 따로 검사할 수 있어야
 * 한다(`tests/unit/inquiry-category-kind-move.test.ts`).
 */

export type InquiryCategoryKindMove = {
  label: string
  before: InquiryKind
  after: InquiryKind
  /** 이 카테고리로 접수된 문의 수. 1건 이상일 때만 이 값이 만들어진다. */
  usageCount: number
}

/**
 * 확인이 필요한 이동인가.
 *
 * 셋 다 참일 때만 만든다 — 수정 중이고(등록에는 옮길 과거가 없다), 종류가 실제로
 * 바뀌었고, 그 분류로 접수된 문의가 있다. 접수 0건이면 잃을 것이 없으므로 묻지
 * 않는다. 모든 저장에 확인을 붙이면 운영자가 습관적으로 누르고 확인이 뜻을 잃는다
 * (DEVELOPER-GUIDE §7.4).
 */
export function kindMoveOf(
  category: { label: string; kind: InquiryKind; usageCount: number } | undefined,
  nextKind: InquiryKind,
): InquiryCategoryKindMove | null {
  if (category === undefined || category.kind === nextKind || category.usageCount === 0) {
    return null
  }

  return {
    label: category.label,
    before: category.kind,
    after: nextKind,
    usageCount: category.usageCount,
  }
}

/**
 * 확인 문구.
 *
 * 건수를 문장에 박는 것이 핵심이다 — "종류가 바뀝니다"만으로는 이 카테고리로 접수된
 * 과거 문의까지 다른 창구로 옮겨 간다는 사실이 드러나지 않는다(트리거가 아니라
 * `update_inquiry_category()` 가 같은 트랜잭션에서 함께 옮긴다).
 */
export function kindMoveNotice(move: InquiryCategoryKindMove): string {
  const before = INQUIRY_KIND_MAP[move.before].label
  const after = INQUIRY_KIND_MAP[move.after].label

  return `${move.label} 카테고리를 ${before} → ${after} 로 옮깁니다. 이 카테고리로 접수된 문의 ${move.usageCount}건의 종류도 함께 바뀝니다.`
}
