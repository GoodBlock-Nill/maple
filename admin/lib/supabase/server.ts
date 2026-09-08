import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { requireEnv } from '@/lib/supabase/env'

import type { TypedSupabaseClient } from '@/lib/supabase/types'
import type { Database } from '@/types/database.types'

/**
 * 서버 컴포넌트 · 라우트 핸들러 · 서버 액션용 Supabase 클라이언트.
 *
 * 요청마다 새로 만들어야 한다. 모듈 스코프에 캐시하면 A 관리자의 세션이
 * B 관리자의 요청에 섞인다.
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
