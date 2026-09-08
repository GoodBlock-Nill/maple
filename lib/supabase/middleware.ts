import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

import { requireEnv } from '@/lib/supabase/env'

import type { User } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import type { Database } from '@/types/database.types'

export type SessionUpdate = {
  /**
   * 갱신된 인증 쿠키가 실린 응답. **이 객체를 그대로 반환하거나, 새 응답을 만들 때
   * 쿠키를 복사해야 한다.** 그러지 않으면 리프레시된 토큰이 브라우저에 저장되지 않아
   * 사용자가 임의로 로그아웃되는 현상이 생긴다.
   */
  response: NextResponse
  /** `getUser()` 로 Auth 서버 검증까지 마친 사용자. 미로그인이면 null. */
  user: User | null
}

/**
 * 프록시(구 미들웨어)에서 Supabase 세션을 갱신한다.
 *
 * 서버 컴포넌트는 렌더 도중 쿠키를 쓸 수 없다. 따라서 액세스 토큰 갱신은
 * 반드시 요청 앞단(프록시)에서 일어나야 한다.
 *
 * 검증에는 `getSession()` 이 아니라 `getUser()` 를 쓴다. `getSession()` 은 쿠키에
 * 담긴 JWT 를 그대로 신뢰하므로, 위조된 쿠키를 들고 온 요청을 통과시킬 수 있다.
 */
export async function updateSession(request: NextRequest): Promise<SessionUpdate> {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }

          // 요청 쿠키를 바꾼 뒤 응답을 다시 만들어야 다운스트림(서버 컴포넌트)이
          // 갱신된 토큰을 읽는다.
          response = NextResponse.next({ request })

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }

          // 인증 쿠키가 실린 응답은 CDN 이 캐시하면 안 된다(다른 사용자에게 세션 유출).
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value)
          }
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user }
}
