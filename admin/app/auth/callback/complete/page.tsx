import { CallbackComplete } from '@/components/auth/CallbackComplete'
import { firstValue } from '@/lib/utils/table-query'
import { sanitizeNextPath } from '@/lib/validation/auth'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '로그인 처리 중',
  robots: { index: false, follow: false },
}

export default async function CallbackCompletePage(props: PageProps<'/auth/callback/complete'>) {
  const searchParams = await props.searchParams
  const nextPath = sanitizeNextPath(firstValue(searchParams.next))

  return (
    <div className="bg-sidebar flex min-h-dvh items-center justify-center px-4">
      <div className="rounded-card bg-surface shadow-menu px-6 py-7 text-center">
        <CallbackComplete nextPath={nextPath} />
      </div>
    </div>
  )
}
