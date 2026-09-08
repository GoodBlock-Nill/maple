import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { sanitizeNextPath } from '@/lib/validation/auth'

import type { EmailOtpType } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

/**
 * 이메일 OTP(가입 확인 · 비밀번호 재설정 · 메일 변경) 검증 엔드포인트.
 *
 * Supabase 메일 템플릿이 `?token_hash=...&type=...` 로 보내는 링크를 받는다.
 * `token_hash` 는 1회용이므로 검증 뒤에는 URL 에 남기지 않고 목적지로 보낸다.
 */

/** 이 사이트가 처리하는 메일 링크 종류만 허용한다. */
const ALLOWED_TYPES: readonly EmailOtpType[] = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
]

function parseOtpType(value: string | null): EmailOtpType | null {
  return ALLOWED_TYPES.find((type) => type === value) ?? null
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = parseOtpType(searchParams.get('type'))
  const nextPath = sanitizeNextPath(searchParams.get('next'))

  if (tokenHash === null || type === null) {
    return NextResponse.redirect(new URL('/login?error=invalid_link', origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

  if (error !== null) {
    return NextResponse.redirect(new URL('/login?error=link_expired', origin))
  }

  return NextResponse.redirect(new URL(nextPath, origin))
}
