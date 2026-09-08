import { createBrowserClient } from '@supabase/ssr'

import { requireEnv } from '@/lib/supabase/env'

import type { TypedSupabaseClient } from '@/lib/supabase/types'
import type { Database } from '@/types/database.types'

/**
 * 브라우저(클라이언트 컴포넌트)용 Supabase 클라이언트.
 *
 * `@supabase/ssr` 의 브라우저 클라이언트는 내부적으로 싱글턴이라 호출할 때마다
 * 새 연결이 생기지 않는다. 그래서 모듈 최상단에서 만들지 않고(빌드 시점에
 * 환경 변수를 강제 평가하지 않도록) 호출 시점에 생성한다.
 *
 * 세션은 쿠키에 저장되므로 서버 컴포넌트/프록시에서도 같은 세션을 읽는다.
 */
export function createClient(): TypedSupabaseClient {
  return createBrowserClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  )
}
