import { readFileSync } from 'node:fs'
import path from 'node:path'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, type Page } from '@playwright/test'

/**
 * 고객지원(1:1 문의 · FAQ) E2E 공용 도구.
 *
 * 자격 증명은 저장소에 두지 않는다 — 스크래치패드의 env 파일을 **테스트 실행 중에만**
 * 읽는다(경로는 ADMIN_E2E_SECRETS 로 덮어쓸 수 있다).
 */

const SECRETS_PATH =
  process.env.ADMIN_E2E_SECRETS ??
  '/private/tmp/claude-501/-Users-goodblock-Projects-maple/61a98c42-b684-4d24-8c7f-385f43df2325/scratchpad/admin-bootstrap.env'

export const SHOT_DIR =
  process.env.ADMIN_E2E_SHOTS ??
  '/private/tmp/claude-501/-Users-goodblock-Projects-maple/61a98c42-b684-4d24-8c7f-385f43df2325/scratchpad/verify'

/**
 * 사용자 사이트는 **로컬 개발 서버**를 본다. `.env.local` 의
 * `NEXT_PUBLIC_CLIENT_SITE_URL` 은 배포본을 가리켜서(운영 링크용), 그대로 쓰면 방금
 * 만든 데이터가 프로덕션 캐시에 막혀 보이지 않는다.
 */
export const CLIENT_URL = process.env.CLIENT_E2E_URL ?? 'http://localhost:3000'

function readEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {}

  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)

    if (match?.[1] !== undefined && match[2] !== undefined) {
      result[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  }

  return result
}

const secrets = readEnvFile(SECRETS_PATH)
const localEnv = readEnvFile(path.join(process.cwd(), '.env.local'))

const ADMIN_EMAIL = secrets.ADMIN_BOOTSTRAP_EMAIL ?? ''
const ADMIN_PASSWORD = secrets.ADMIN_BOOTSTRAP_PASSWORD ?? ''

export function screenshotPath(name: string): string {
  return path.join(SHOT_DIR, name)
}

/** 서비스 롤 — 픽스처 생성·정리와 "실제로 저장됐는가" 확인에만 쓴다. */
export function createServiceClient(): SupabaseClient {
  const url = localEnv.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = localEnv.SUPABASE_SERVICE_ROLE_KEY

  expect(url, '.env.local 에 NEXT_PUBLIC_SUPABASE_URL 이 필요합니다').toBeTruthy()
  expect(serviceKey, '.env.local 에 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다').toBeTruthy()

  return createClient(url!, serviceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** 익명 키 — 사용자 사이트의 공개 조회와 같은 권한(RLS 가 그대로 적용된다). */
export function createAnonClient(): SupabaseClient {
  const url = localEnv.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY

  expect(anonKey, '.env.local 에 NEXT_PUBLIC_SUPABASE_ANON_KEY 가 필요합니다').toBeTruthy()

  return createClient(url!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('이메일').fill(ADMIN_EMAIL)
  await page.getByLabel('비밀번호').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: '로그인' }).click()
  // 로그인 리다이렉트가 끝나기 전에 이동하면 대시보드가 그 방문을 덮어쓴다.
  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible()
}
