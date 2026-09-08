import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import { requireEnv } from '@/lib/supabase/env'

import type { TypedSupabaseClient } from '@/lib/supabase/types'
import type { Database } from '@/types/database.types'

/**
 * 서비스 롤 클라이언트 — **RLS 를 완전히 우회한다.**
 *
 * `import 'server-only'` 는 이 모듈이 클라이언트 번들에 섞이면 빌드를 실패시킨다.
 * 서비스 롤 키가 브라우저로 새어 나가면 전체 DB 가 열리므로, 실수를 런타임이 아니라
 * 빌드 타임에 잡는 것이 중요하다.
 *
 * 관리자 사이트에서 이 클라이언트를 쓰는 곳은 **Auth Admin API 가 필요한 경로뿐**이다
 * (초대 메일 발송, 계정 상태 변경). 나머지 읽기/쓰기는 전부 `server.ts` 의 세션
 * 클라이언트로 하고 RLS(`public.is_admin()`)가 다시 검사하게 둔다 — 서비스 롤을
 * 일반 경로에 쓰면 권한 버그가 조용히 통과한다.
 */
export function createAdminClient(): TypedSupabaseClient {
  return createSupabaseClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY),
    {
      auth: {
        /* 서비스 롤은 사용자 세션이 없다. 토큰 갱신·저장을 모두 끈다. */
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  )
}
