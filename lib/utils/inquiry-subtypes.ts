/**
 * 세부 문의 유형 판정 (`inquiry_categories.subtypes`).
 *
 * 유형 셀렉트는 더 이상 고정 3종('문의 · 신고 · 제안')이 아니라 **고른 카테고리에
 * 매달린 목록**이다(마이그레이션 20260910000700 · docs/1on1.md). 화면(폼)과 서버
 * 검증이 같은 답을 내야 "보이는데 접수는 거절"이 생기지 않으므로, 판정을 React 밖의
 * 순수 함수로 두고 양쪽이 이 파일 하나만 부른다.
 *
 * 의존성을 두지 않는 이유도 같다 — 클라이언트 컴포넌트 · 서버 액션 · 단위 테스트가
 * 모두 그대로 가져다 쓸 수 있어야 한다.
 */

/** 판정에 필요한 최소 모양. `InquiryCategoryOption` 이 그대로 들어맞는다. */
export type InquiryCategoryChoice = {
  label: string
  subtypes: readonly string[]
}

/**
 * 세부 유형이 없는 카테고리로 접수할 때 저장되는 값.
 *
 * 셀렉트를 감추는 대신 `type` 을 비워 두면 관리자 목록의 "카테고리 · 유형" 칸이
 * 반쯤 빈 채로 남고, 유형 필터에서도 찾을 수 없는 문의가 된다. 한 종뿐인 셀렉트를
 * 억지로 세우는 것보다 값 하나를 정해 두는 편이 화면도 데이터도 단순하다.
 */
export const INQUIRY_SUBTYPE_FALLBACK = '기타'

function findChoice(
  categories: readonly InquiryCategoryChoice[],
  label: string,
): InquiryCategoryChoice | undefined {
  return categories.find((category) => category.label === label)
}

/**
 * 이 카테고리가 들고 있는 세부 유형 그대로. 모르는 라벨이면 빈 목록이다.
 *
 * 폼은 이 결과가 비었는지로 셀렉트를 세울지 감출지 정한다.
 */
export function inquirySubtypesOf(
  categories: readonly InquiryCategoryChoice[],
  label: string,
): readonly string[] {
  return findChoice(categories, label)?.subtypes ?? []
}

/**
 * 접수에 허용되는 `type` 값.
 *
 * 세부 유형이 없는 카테고리(운영자가 항목을 비워 둔 경우 · 조회 실패 폴백)에서는
 * 폴백 한 종만 받는다 — 폼이 hidden 으로 싣는 값과 같아야 한다.
 */
export function allowedInquiryTypes(
  categories: readonly InquiryCategoryChoice[],
  label: string,
): readonly string[] {
  const subtypes = inquirySubtypesOf(categories, label)

  return subtypes.length > 0 ? subtypes : [INQUIRY_SUBTYPE_FALLBACK]
}
