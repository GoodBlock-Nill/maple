import { INQUIRY_KINDS } from '@/lib/constants/inquiry-kind'

import type { InquiryKind } from '@/lib/constants/inquiry-kind'

/**
 * 카테고리 목록 → 창구(kind)별 섹션.
 *
 * 조회는 한 번이고(`getInquiryCategories`), 나누는 일은 여기서 한다 — 창구마다 질의를
 * 던지면 사용 건수 집계가 세 번 돌고 세 섹션이 서로 다른 시점을 보게 된다.
 *
 * 섹션의 순서와 제목은 `INQUIRY_KINDS` 를 그대로 따른다(1:1 문의 · 버그제보 ·
 * 불법이용제보). 사용자 사이트의 고객지원 메뉴와 같은 순서라, 운영자가 두 화면을
 * 오갈 때 눈이 같은 자리를 찾는다.
 *
 * 비어 있는 창구도 자리를 남긴다 — "버그제보 카테고리가 없다"는 사실 자체가 화면에
 * 보여야 운영자가 추가할 곳을 찾는다.
 */

export type InquiryCategorySection<TCategory> = {
  kind: InquiryKind
  /** 섹션 제목에 쓰는 짧은 이름('1:1 문의' · '버그제보' · '불법이용제보'). */
  label: string
  categories: readonly TCategory[]
}

/**
 * `sort_order` 는 **kind 안에서의** 순서다(마이그레이션 20260914000100). 그래서 섹션
 * 안에서만 정렬하고, 같은 값이면 들어온 순서를 유지한다(조회가 `created_at` 으로
 * 2차 정렬해 둔 순서 = 사용자 폼과 같은 순서).
 */
export function groupInquiryCategoriesByKind<
  TCategory extends { kind: InquiryKind; sortOrder: number },
>(categories: readonly TCategory[]): readonly InquiryCategorySection<TCategory>[] {
  return INQUIRY_KINDS.map((kind) => ({
    kind: kind.value,
    label: kind.label,
    categories: categories
      .filter((category) => category.kind === kind.value)
      .sort((left, right) => left.sortOrder - right.sortOrder),
  }))
}
