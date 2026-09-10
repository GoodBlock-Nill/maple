import { permanentRedirect } from 'next/navigation'

import { firstValue } from '@/lib/utils/list-query'
import { sanitizeNextPath } from '@/lib/validation/auth'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '회원가입',
  robots: { index: false, follow: false },
}

/**
 * 옛 가입 경로는 `/signup` 으로 영구 이동한다(308).
 *
 * 밖에 나간 링크(북마크·검색결과·안내 메일)가 깨지지 않도록 경로 자체는 남겨 둔다.
 */
export default async function RegisterPage(props: PageProps<'/register'>) {
  const searchParams = await props.searchParams
  const nextPath = sanitizeNextPath(firstValue(searchParams.next))

  permanentRedirect(nextPath === '/' ? '/signup' : `/signup?next=${encodeURIComponent(nextPath)}`)
}
