import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { sanitizeNextPath } from '@/lib/validation/auth'

import type { EmailOtpType } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

/**
 * 초대 · 비밀번호 재설정 메일 링크의 착지점.
 *
 * Supabase 는 링크 종류와 프로젝트 설정에 따라 세 가지 방식으로 돌려보낸다.
 *   1) `?code=`                — PKCE. 서버에서 세션으로 교환한다.
 *   2) `?token_hash=&type=`    — 메일 템플릿이 `{{ .TokenHash }}` 를 쓸 때.
 *   3) `#access_token=…`       — 암시적 흐름. 해시는 서버로 전송되지 않는다.
 *
 * 1·2 는 여기서 끝내고, 3 은 해시를 읽을 수 있는 브라우저에게 넘긴다
 * (`/auth/callback/complete`). 리다이렉트 시 프래그먼트는 브라우저가 그대로
 * 이어 붙이므로 정보가 유실되지 않는다.
 */

const ALLOWED_TYPES: readonly EmailOtpType[] = ['invite', 'recovery', 'magiclink', 'signup', 'email']

function parseOtpType(value: string | null): EmailOtpType | null {
  return ALLOWED_TYPES.find((type) => type === value) ?? null
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl
  const nextPath = sanitizeNextPath(searchParams.get('next'))

  // 제공자가 사용자 취소·설정 오류를 알릴 때 쓰는 규격(OAuth 2.0 §4.1.2.1).
  if (searchParams.get('error') !== null) {
    return NextResponse.redirect(new URL('/login?error=auth_failed', origin))
  }

  const code = searchParams.get('code')

  if (code !== null) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error !== null) {
      return NextResponse.redirect(new URL('/login?error=link_expired', origin))
    }

    return NextResponse.redirect(new URL(nextPath, origin))
  }

  const tokenHash = searchParams.get('token_hash')
  const type = parseOtpType(searchParams.get('type'))

  if (tokenHash !== null && type !== null) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

    if (error !== null) {
      return NextResponse.redirect(new URL('/login?error=link_expired', origin))
    }

    return NextResponse.redirect(new URL(nextPath, origin))
  }

  const complete = new URL('/auth/callback/complete', origin)
  complete.searchParams.set('next', nextPath)

  return NextResponse.redirect(complete)
}
