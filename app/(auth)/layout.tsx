import { AuthShell } from '@/components/auth/AuthShell'

import type { ReactNode } from 'react'

/** /login · /register 셸. 실제 마크업은 `/auth/*` 와 함께 쓰는 `AuthShell` 에 있다. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>
}
