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
 * 사용 범위: 관리자 배치(랭킹 CSV 업로드 등), 웹훅, 시드 스크립트.
 * 사용자 요청 처리에는 쓰지 말 것 — 그 경로는 항상 `server.ts` 의 클라이언트를 쓴다.
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
