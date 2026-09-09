import { readFileSync } from 'node:fs'
import path from 'node:path'

import { createClient } from '@supabase/supabase-js'
import { expect, test, type Page } from '@playwright/test'

/**
 * Phase 0 인수 검증.
 *
 * 자격 증명은 저장소에 두지 않는다. 스크래치패드의 env 파일에서 **테스트 안에서만**
 * 읽는다(경로는 ADMIN_E2E_SECRETS 로 덮어쓸 수 있다).
 */
const SECRETS_PATH =
  process.env.ADMIN_E2E_SECRETS ??
  '/private/tmp/claude-501/-Users-goodblock-Projects-maple/61a98c42-b684-4d24-8c7f-385f43df2325/scratchpad/admin-bootstrap.env'

const SHOT_DIR =
  process.env.ADMIN_E2E_SHOTS ??
  '/private/tmp/claude-501/-Users-goodblock-Projects-maple/61a98c42-b684-4d24-8c7f-385f43df2325/scratchpad/verify'

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
const NONADMIN_EMAIL = secrets.E2E_NONADMIN_EMAIL ?? ''
const NONADMIN_PASSWORD = secrets.E2E_NONADMIN_PASSWORD ?? ''

/** 사이드바가 거는 모든 목적지. 하나라도 200 이 아니면 내비게이션이 끊긴 것이다. */
const NAV_DESTINATIONS = [
  '/',
  '/news',
  '/community/posts',
  '/community/comments',
  '/reports',
  '/members',
  '/inquiries',
  '/faqs',
  '/gacha',
  '/rankings',
  '/settings',
  '/admins',
  '/audit',
]

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('이메일').fill(email)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()
}

test.beforeAll(async () => {
  // 권한 거부를 확인할 일회용 일반 사용자. 이미 있으면 비밀번호만 맞춘다.
  const url = localEnv.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = localEnv.SUPABASE_SERVICE_ROLE_KEY

  expect(url, '.env.local 에 NEXT_PUBLIC_SUPABASE_URL 이 필요합니다').toBeTruthy()
  expect(serviceKey, '.env.local 에 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다').toBeTruthy()

  const supabase = createClient(url!, serviceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const created = await supabase.auth.admin.createUser({
    email: NONADMIN_EMAIL,
    password: NONADMIN_PASSWORD,
    email_confirm: true,
  })

  let userId = created.data.user?.id

  if (userId === undefined) {
    const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
    userId = data.users.find((user) => user.email === NONADMIN_EMAIL)?.id

    if (userId !== undefined) {
      await supabase.auth.admin.updateUserById(userId, {
        password: NONADMIN_PASSWORD,
        email_confirm: true,
      })
    }
  }

  expect(userId, '일반 사용자 계정을 만들지 못했습니다').toBeTruthy()

  // 초대장이 남아 있으면 트리거가 관리자로 만들었을 수 있다. 명시적으로 되돌린다.
  await supabase.from('profiles').update({ role: 'user' }).eq('id', userId!)
})

test('anonymous visitors are sent to the login page', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: '관리자 로그인' })).toBeVisible()
  await page.screenshot({ path: path.join(SHOT_DIR, 'admin-login.png'), fullPage: true })
})

test('a bootstrap admin can sign in and read the dashboard', async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)

  await expect(page).toHaveURL(/localhost:3100\/$/)
  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible()

  // 지표 카드가 실제 숫자를 담고 있어야 한다("-" 나 빈 값이면 조회가 실패한 것이다).
  for (const testId of [
    'stat-profiles',
    'stat-news',
    'stat-community',
    'stat-comments',
    'stat-reports',
    'stat-inquiries',
  ]) {
    const card = page.getByTestId(testId)
    await expect(card).toBeVisible()
    await expect(card.locator('strong')).toHaveText(/^[\d,]+$/)
  }

  await page.screenshot({ path: path.join(SHOT_DIR, 'admin-dashboard.png'), fullPage: true })
})

test('every sidebar destination responds with 200', async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible()

  for (const destination of NAV_DESTINATIONS) {
    const response = await page.goto(destination)

    expect(response?.status(), `${destination} 응답 코드`).toBe(200)
    expect(page.url(), `${destination} 는 리다이렉트되면 안 된다`).toContain(destination)
    await expect(page.locator('h1')).toBeVisible()
  }
})

test('the admins page shows accounts, invites and roles', async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  // 로그인 후 리다이렉트가 끝나기 전에 이동하면 대시보드가 이 방문을 덮어쓴다.
  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible()
  await page.goto('/admins')

  await expect(page.getByRole('heading', { name: '관리자', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: ADMIN_EMAIL })).toBeVisible()
  await expect(page.getByRole('button', { name: '관리자 초대' })).toBeVisible()

  // 부트스트랩 계정은 슈퍼어드민이어야 한다(마이그레이션 20260909000200 의 백필).
  await expect(page.getByRole('cell', { name: '슈퍼어드민' }).first()).toBeVisible()

  // 자기 자신은 지우거나 역할을 바꿀 수 없다 — 버튼 대신 안내 문구가 나온다.
  await expect(page.getByText('본인')).toBeVisible()
  await expect(page.getByText('자기 역할은 바꿀 수 없습니다.')).toBeVisible()

  // 권한(역할) 관리 — 시스템 역할은 지울 수 없고, 새 역할은 여기서 만든다.
  await expect(page.getByRole('button', { name: '역할 추가' })).toBeVisible()
  await expect(page.getByText('시스템 역할')).toBeVisible()

  await page.screenshot({ path: path.join(SHOT_DIR, 'admin-admins.png'), fullPage: true })
})

/* 로그인 화면은 이메일+비밀번호 하나뿐이다(2026-09-09 제품 결정). 간편로그인 버튼이
   되살아나면 글자월드 회원 누구나 눌러 보고 "권한 없음"으로 튕기는 문이 다시 생긴다. */
test('the login page offers only the password form', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: '관리자 로그인' })).toBeVisible()
  await expect(page.getByText('초대받은 관리자 계정으로 로그인하세요.')).toBeVisible()
  await expect(page.getByLabel('이메일')).toBeVisible()
  await expect(page.getByLabel('비밀번호')).toBeVisible()
  await expect(page.getByRole('link', { name: '비밀번호 재설정' })).toBeVisible()

  for (const label of ['구글로 시작하기', '카카오로 시작하기', '네이버로 시작하기']) {
    await expect(page.getByRole('button', { name: label })).toHaveCount(0)
  }

  await page.screenshot({ path: path.join(SHOT_DIR, 'admin-login.png'), fullPage: true })
})

test('signing out returns to the login page and locks the console', async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible()

  await page.getByRole('button', { name: '로그아웃' }).click()
  await expect(page).toHaveURL(/\/login/)

  await page.goto('/admins')
  await expect(page).toHaveURL(/\/login/)
})

test('a non-admin account is refused', async ({ page }) => {
  await signIn(page, NONADMIN_EMAIL, NONADMIN_PASSWORD)

  await expect(page.getByText('관리자 권한이 없는 계정입니다.')).toBeVisible()
  await expect(page).toHaveURL(/\/login/)

  // 세션도 남지 않아야 한다.
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})

test('a session idle for more than 30 minutes is expired by the proxy', async ({
  page,
  context,
}) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible()

  // 31분 전 활동으로 되돌린다. 프록시는 이 쿠키만 보고 만료를 판정한다.
  const staleStamp = String(Date.now() - 31 * 60 * 1000)
  await context.addCookies([
    { name: 'admin_last_seen', value: staleStamp, domain: 'localhost', path: '/' },
  ])

  await page.goto('/admins')

  await expect(page).toHaveURL(/\/login\?error=expired/)
  await expect(page.getByText('30분 동안 활동이 없어')).toBeVisible()

  // 세션 자체가 끊겼는지 확인한다(쿠키만 지운 것이 아니어야 한다).
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})
