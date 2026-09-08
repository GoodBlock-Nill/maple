import { AuthShell } from '@/components/auth/AuthShell'

import type { ReactNode } from 'react'

/**
 * `/auth/*` 페이지 셸(현재는 /auth/onboarding 하나).
 *
 * 같은 폴더의 라우트 핸들러(`callback` · `confirm`)에는 레이아웃이 적용되지 않는다
 * (Next 16 문서 — 레이아웃은 페이지 트리에만 관여한다).
 */
export default function AuthSegmentLayout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>
}
