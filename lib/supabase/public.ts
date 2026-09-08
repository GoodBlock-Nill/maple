import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import { requireEnv } from '@/lib/supabase/env'

import type { TypedSupabaseClient } from '@/lib/supabase/types'
import type { Database } from '@/types/database.types'

/**
 * 공개 읽기 전용 클라이언트 — **쿠키를 읽지 않는다.**
 *
 * `unstable_cache` 안에서는 `cookies()`/`headers()` 같은 요청 시점 API 를 쓸 수 없다
 * (Next 16 문서 `unstable_cache` "Good to know"). 그래서 세션이 필요 없는 공개
 * 데이터(FAQ · 사이트 설정 · 확률형 아이템 · 랭킹)는 `server.ts` 의 쿠키 바인딩
 * 클라이언트 대신 이 익명 클라이언트로 읽는다.
 *
 * 권한 관점에서는 anon 키 + RLS 그대로다. 위 네 테이블은 정책이 `to anon` 으로
 * 열려 있고 사용자별로 결과가 달라지지 않으므로 캐시에 담아도 유출이 없다.
 * 사용자 문맥이 섞이는 게시글·댓글·프로필 조회에는 절대 쓰지 않는다.
 */
export function createPublicClient(): TypedSupabaseClient {
  return createSupabaseClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      auth: {
        /* 세션을 만들지도 갱신하지도 않는다. 항상 anon 권한으로만 동작한다. */
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  )
}
