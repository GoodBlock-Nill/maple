import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { requireEnv } from '@/lib/supabase/env'

import type { TypedSupabaseClient } from '@/lib/supabase/types'
import type { Database } from '@/types/database.types'

/**
 * 서버 컴포넌트 · 라우트 핸들러 · 서버 액션용 Supabase 클라이언트.
 *
 * 요청마다 새로 만들어야 한다. 모듈 스코프에 캐시하면 A 사용자의 세션이
 * B 사용자의 요청에 섞인다.
 */
export async function createClient(): Promise<TypedSupabaseClient> {
  // Next 16 의 cookies() 는 비동기다. 요청 스코프 밖에서 호출하면 예외가 난다.
  const cookieStore = await cookies()

  return createServerClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            /* 서버 컴포넌트 렌더 중에는 쿠키를 쓸 수 없어 예외가 난다.
               토큰 갱신은 proxy.ts 의 updateSession() 이 이미 처리했으므로
               여기서는 무시해도 세션이 끊기지 않는다. */
          }
        },
      },
    },
  )
}

/**
 * 로그인 사용자와 프로필을 한 번에 읽는다.
 *
 * `getUser()` 는 Auth 서버에 토큰 검증을 요청한다. `getSession()` 은 쿠키를 그대로
 * 신뢰하므로 위·변조된 쿠키를 통과시킬 수 있어 서버 인가 판단에는 쓰지 않는다.
 */
export async function getCurrentProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user === null) {
    return { user: null, profile: null } as const
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, nickname, avatar_url, role, email, created_at, updated_at')
    .eq('id', user.id)
    .maybeSingle()

  return { user, profile } as const
}
