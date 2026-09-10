'use client'

import { createContext, useContext } from 'react'

/**
 * 방금 등록한 이력 id.
 *
 * 등록 폼과 등록 내역은 **서로 다른 카드**다(시안 §5 의 선택 항목을 카드로 승격).
 * 등록이 성공하면 서버 액션이 `refresh()` 로 목록을 다시 그리는데, 그 목록의 어느
 * 줄이 방금 만든 것인지는 폼만 안다 — 액션 결과에 담겨 오는 `redemptionId` 다.
 *
 * URL 파라미터(`?registered=…`)로 넘기지 않는다. 새로고침·뒤로가기에서 강조가
 * 되살아나고, 공유된 주소에 남의 이력 id 가 실려 다니게 된다. 한 번 보고 사라지는
 * 표식이므로 화면 안에서만 흐르는 컨텍스트가 맞다.
 */
export const CouponHighlightContext = createContext<string | null>(null)

export function useCouponHighlight(): string | null {
  return useContext(CouponHighlightContext)
}
