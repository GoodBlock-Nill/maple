import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { sanitizeNextPath } from '@/lib/validation/auth'

import type { TypedSupabaseClient } from '@/lib/supabase/types'
import type { EmailOtpType } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

/**
 * 초대 · 비밀번호 재설정 링크의 착지점.
 *
 * 어느 쪽으로 들어오든 세션이 생기고 나면 `profiles.role` 을 확인한다
 * (`rejectNonAdmin`) — 관리자 앱의 문턱은 "로그인에 성공했는가"가 아니라
 * "관리자로 승격된 계정인가"다.
 *
 * Supabase 는 링크 종류와 프로젝트 설정에 따라 세 가지 방식으로 돌려보낸다.
 *   1) `?code=`                — PKCE. 서버에서 세션으로 교환한다.
 *   2) `?token_hash=&type=`    — 메일 템플릿이 `{{ .TokenHash }}` 를 쓸 때.
 *   3) `#access_token=…`       — 암시적 흐름. 해시는 서버로 전송되지 않는다.
 *
 * 1·2 는 여기서 끝내고, 3 은 해시를 읽을 수 있는 브라우저에게 넘긴다
 * (`/auth/callback/complete`). 리다이렉트 시 프래그먼트는 브라우저가 그대로
 * 이어 붙이므로 정보가 유실되지 않는다.
 *
 * 초대 메일은 `?next=/invite/accept` 로 돌아온다 — 거기서 비밀번호를 정한다.
 */

const ALLOWED_TYPES: readonly EmailOtpType[] = [
  'invite',
  'recovery',
  'magiclink',
  'signup',
  'email',
]

const ADMIN_ROLE = 'admin'

function parseOtpType(value: string | null): EmailOtpType | null {
  return ALLOWED_TYPES.find((type) => type === value) ?? null
}

/**
 * 링크로 막 만들어진 세션이 **관리자의 것인지** 확인한다.
 *
 * 초대 링크로 들어온 계정은 `handle_new_user()` 가 이미 role='admin' 으로 만들어
 * 두었으므로 그대로 통과한다. 그 밖의 경로(비밀번호 재설정 메일을 받은 일반
 * 회원 등)로 세션이 생겼다면 남기지 않고 되돌린다 — 남기면 "로그인은 됐는데 모든
 * 화면이 튕기는" 상태에 갇힌다.
 *
 * 통과면 `null`, 아니면 로그인으로 되돌릴 응답을 준다.
 */
async function rejectNonAdmin(
  supabase: TypedSupabaseClient,
  userId: string,
  origin: string,
): Promise<NextResponse | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (profile !== null && profile.role === ADMIN_ROLE) {
    return null
  }

  await supabase.auth.signOut()

  return NextResponse.redirect(new URL('/login?error=not_admin', origin))
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
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error !== null) {
      return NextResponse.redirect(new URL('/login?error=link_expired', origin))
    }

    const rejected = await rejectNonAdmin(supabase, data.user.id, origin)

    return rejected ?? NextResponse.redirect(new URL(nextPath, origin))
  }

  const tokenHash = searchParams.get('token_hash')
  const type = parseOtpType(searchParams.get('type'))

  if (tokenHash !== null && type !== null) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

    if (error !== null || data.user === null) {
      return NextResponse.redirect(new URL('/login?error=link_expired', origin))
    }

    // 메일 링크로 들어온 세션도 같은 잣대로 잰다. 링크 하나로 비관리자가
    // 관리자 쿠키를 얻는 우회로를 남기지 않는다.
    const rejected = await rejectNonAdmin(supabase, data.user.id, origin)

    return rejected ?? NextResponse.redirect(new URL(nextPath, origin))
  }

  const complete = new URL('/auth/callback/complete', origin)
  complete.searchParams.set('next', nextPath)

  return NextResponse.redirect(complete)
}
