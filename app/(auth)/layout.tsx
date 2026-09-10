import type { ReactNode } from 'react'

/**
 * `(auth)` 라우트 그룹 껍데기.
 *
 * 로그인은 자기 배경(#f6f7fa)과 홈 푸터를 직접 그리고, "내 정보"는 `MyPageShell`
 * 을 쓴다. 공통 셸을 여기에 두면 두 셸이 겹쳐 헤더가 두 번 그려지므로 이
 * 레이아웃은 아무것도 감싸지 않는다.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return children
}
