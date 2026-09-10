import type { ReactNode } from 'react'

/**
 * `/auth/*` 세그먼트 껍데기.
 *
 * 회원가입(온보딩)은 자기 배경(#f6f7fa)과 홈 푸터를 직접 그리고, 계정 복구는
 * `AuthShell` 을 쓴다. 공통 셸을 여기에 두면 두 셸이 겹쳐 헤더가 두 번 그려지므로
 * 이 레이아웃은 아무것도 감싸지 않는다(`(auth)` 레이아웃과 같은 이유다).
 *
 * 같은 폴더의 라우트 핸들러(`callback` · `confirm`)에는 레이아웃이 적용되지 않는다
 * (Next 16 문서 — 레이아웃은 페이지 트리에만 관여한다).
 */
export default function AuthSegmentLayout({ children }: { children: ReactNode }) {
  return children
}
