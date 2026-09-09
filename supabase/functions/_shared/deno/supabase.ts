/**
 * Edge Function 안의 Supabase 클라이언트.
 *
 * 서비스 롤은 **여기서만** 쓴다(기획서 §3). 관리자 콘솔은 세션 클라이언트 + RLS 로 읽고 쓰며,
 * 함수는 자기 경계 안에서 웹훅 insert 와 발송 상태 갱신만 서비스 롤로 한다.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { requireEnv } from './env.ts'

const NO_SESSION = {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
} as const

export function createServiceClient(): SupabaseClient {
  return createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    NO_SESSION,
  )
}

/** 호출자의 JWT 를 그대로 싣는 anon 클라이언트. `auth.getUser()` 로 토큰을 검증한다. */
export function createCallerClient(authorization: string): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    ...NO_SESSION,
    global: { headers: { Authorization: authorization } },
  })
}

export function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

/** Postgres 유니크 위반. 중복 접수·중복 전달을 "이미 처리됨"으로 읽는 근거. */
export const UNIQUE_VIOLATION = '23505'

export function isUniqueViolation(error: { code?: string } | null): boolean {
  return error !== null && error.code === UNIQUE_VIOLATION
}
