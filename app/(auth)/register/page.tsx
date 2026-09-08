import { permanentRedirect } from 'next/navigation'

import { firstValue } from '@/lib/utils/list-query'
import { sanitizeNextPath } from '@/lib/validation/auth'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '회원가입',
  robots: { index: false, follow: false },
}

/**
 * 가입 경로는 로그인으로 영구 이동한다(308).
 *
 * 간편로그인에는 "가입"과 "로그인"의 구분이 없다 — 첫 로그인이 곧 가입이다.
 * 화면은 하나로 합쳤지만, 밖에 나간 링크(북마크·검색결과·안내 메일)가 깨지지
 * 않도록 경로 자체는 남겨 둔다. 제품 결정 2026-09-08.
 */
export default async function RegisterPage(props: PageProps<'/register'>) {
  const searchParams = await props.searchParams
  const nextPath = sanitizeNextPath(firstValue(searchParams.next))

  permanentRedirect(nextPath === '/' ? '/login' : `/login?next=${encodeURIComponent(nextPath)}`)
}
