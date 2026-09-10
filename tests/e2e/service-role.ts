import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * E2E 에서만 쓰는 서비스 롤 클라이언트.
 *
 * 어떤 흐름은 **화면만으로는 만들 수 없는 상태**를 요구한다. 쿠폰 등록 내역이
 * 그렇다 — 지급 완료·거절은 관리자 콘솔이 적는 값이고, 등록 자체도 쿠폰이 켜져
 * 있어야 가능하다. 그 준비와 뒷정리를 여기서 한다.
 *
 * 키는 `.env.local` 에서만 읽는다(`next dev` 가 이미 그 파일로 뜬다). Playwright
 * 러너는 그 파일을 자동으로 읽지 않으므로 직접 파싱하고, 없으면 `null` 을 돌려
 * 호출한 테스트가 스스로 건너뛰게 한다 — 키가 없다고 전체 스위트가 빨개지면
 * "무엇이 깨졌는지"가 묻힌다.
 */

type EnvMap = Record<string, string>

function readEnvLocal(): EnvMap {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')

    return Object.fromEntries(
      raw
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '' && !line.startsWith('#'))
        .map((line) => {
          const index = line.indexOf('=')

          return [
            line.slice(0, index).trim(),
            line
              .slice(index + 1)
              .trim()
              .replace(/^"|"$/gu, ''),
          ]
        })
        .filter(([key]) => key !== ''),
    )
  } catch {
    return {}
  }
}

export function createServiceClient(): SupabaseClient | null {
  const env = { ...readEnvLocal(), ...process.env } as EnvMap
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return null
  }

  return createClient(url, key, { auth: { persistSession: false } })
}
