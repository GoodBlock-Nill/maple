import { readFileSync } from 'node:fs'
import path from 'node:path'

import { createClient } from '@supabase/supabase-js'
import { expect, test, type Page } from '@playwright/test'

/**
 * 뉴스 상단 고정 최대 3개 제한(2026-09-11 운영 요청) 인수 검증.
 *
 * 실제 운영 데이터(현재 고정 2건)는 건드리지 않는다 — 테스트 전용 글 둘만 만들어
 * 세 번째 고정까지 채우고, 네 번째 시도가 막히는지 확인한다. 정리는 테스트 글
 * 삭제만으로 끝난다(실제 글의 고정 상태는 애초에 바꾸지 않았으므로 되돌릴 것이 없다).
 *
 * 자격 증명은 저장소에 두지 않는다. 스크래치패드의 env 파일에서 **테스트 안에서만** 읽는다.
 */
const SECRETS_PATH =
  process.env.ADMIN_E2E_SECRETS ??
  '/private/tmp/claude-501/-Users-goodblock-Projects-maple/61a98c42-b684-4d24-8c7f-385f43df2325/scratchpad/admin-bootstrap.env'

const SHOT_DIR =
  process.env.NEWS_PIN_E2E_SHOTS ??
  '/private/tmp/claude-501/-Users-goodblock-Projects-maple/61a98c42-b684-4d24-8c7f-385f43df2325/scratchpad/news-pin'

const TITLE_A = '[E2E] 고정 한도 A'
const TITLE_B = '[E2E] 고정 한도 B'
const PIN_LIMIT_MESSAGE =
  '상단 고정은 최대 3개까지 가능합니다. 다른 글의 고정을 해제한 뒤 다시 시도해 주세요.'

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

async function signIn(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('이메일').fill(ADMIN_EMAIL)
  await page.getByLabel('비밀번호').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible()
}

/** 새 뉴스 작성 폼을 채우고 저장한다. 저장 성공 시 글 상세로 리다이렉트된다. */
async function createNews(page: Page, title: string, { pin }: { pin: boolean }): Promise<string> {
  await page.goto('/news/new')
  await page.getByLabel('카테고리').selectOption('notice')
  await page.getByRole('textbox', { name: '제목', exact: true }).fill(title)
  /* 카테고리를 고르면 템플릿이 본문을 미리 채운다 — 전체 선택 후 덮어써서
     테스트 본문만 깔끔하게 남긴다. */
  await page.getByRole('textbox', { name: '본문', exact: true }).click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('상단 고정 한도 테스트용 본문입니다.')
  await page.getByRole('radio', { name: '즉시 발행' }).check()

  if (pin) {
    await page.getByRole('checkbox', { name: '상단 고정' }).check()
  }

  await page.getByRole('button', { name: '저장', exact: true }).click()
  await page.waitForURL(/\/news\/[0-9a-f-]{36}$/u)

  return page.url().split('/').pop() ?? ''
}

test.beforeAll(async () => {
  const url = localEnv.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = localEnv.SUPABASE_SERVICE_ROLE_KEY

  expect(url, '.env.local 에 NEXT_PUBLIC_SUPABASE_URL 이 필요합니다').toBeTruthy()
  expect(serviceKey, '.env.local 에 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다').toBeTruthy()

  const supabase = createClient(url!, serviceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  /* 이전 실행이 남긴 테스트 글을 지운다. 실제 글은 절대 건드리지 않는다(제목
     접두사 `[E2E]` 로만 골라낸다). */
  await supabase.from('posts').delete().eq('board', 'news').in('title', [TITLE_A, TITLE_B])
})

test('at most 3 news posts can be pinned at once', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await signIn(page)

  /* 운영 데이터에는 이미 2건이 고정돼 있다(2026-09-11 기준) — 그 상태는 건드리지
     않고, 테스트 글 한 건을 고정해 한도(3)를 채운다. */
  try {
    /* 1. B 는 고정하지 않은 채 만든다. 이 순간 편집 화면이 읽는 "고정 n/3" 은
       아직 A 가 없는 값(2)이다 — 아래에서 이 탭을 새로고침 없이 그대로 써서
       "화면이 낡은 값을 들고 있어도 서버가 최종 검사를 한다"를 확인한다. */
    await createNews(page, TITLE_B, { pin: false })
    await expect(page.getByText('클라이언트 노출 중')).toBeVisible()

    /* 2. 같은 로그인 세션의 다른 탭에서 A 를 만들고 바로 고정한다 — 이 시점에 실제
       고정 수가 3 이 된다. `browser.newPage()` 는 세션이 없는 새 컨텍스트를 만들어
       버리므로, 반드시 같은 컨텍스트(`page.context()`)에서 탭을 연다. */
    const page2 = await page.context().newPage()

    await createNews(page2, TITLE_A, { pin: true })
    await expect(page2.getByText('고정 3/3')).toBeVisible()
    await page2.screenshot({
      path: path.join(SHOT_DIR, 'news-pin-indicator.png'),
      fullPage: true,
    })

    /* 3. 이제 막 만든 새 글 화면에서는 "상단 고정" 체크박스가 비활성이어야 한다. */
    await page2.goto('/news/new')
    const newPinCheckbox = page2.getByRole('checkbox', { name: '상단 고정' })

    await expect(newPinCheckbox).toBeDisabled()
    await expect(page2.locator('label', { hasText: '상단 고정' }).first()).toHaveAttribute(
      'title',
      /최대 3개/u,
    )
    await page2.close()

    /* 4. 원래 탭(B 편집 화면)은 새로고침하지 않았으므로 체크박스가 여전히
       활성이다. 체크하고 저장을 시도하면 서버가 다시 세어 막는다. */
    const stalePinCheckbox = page.getByRole('checkbox', { name: '상단 고정' })

    await expect(stalePinCheckbox).toBeEnabled()
    await stalePinCheckbox.check()
    await page.getByRole('button', { name: '저장', exact: true }).click()

    await expect(page.getByText(PIN_LIMIT_MESSAGE)).toBeVisible()
    await page.screenshot({
      path: path.join(SHOT_DIR, 'news-pin-limit-error.png'),
      fullPage: true,
    })

    /* B 는 고정되지 않은 채로 남아야 한다. */
    await page.reload()
    await expect(page.getByRole('checkbox', { name: '상단 고정' })).not.toBeChecked()

    /* 5. 고정 필터는 정확히 3건(운영 2건 + 테스트 A)만 보여 준다. */
    await page.goto('/news?pinned=1')
    await expect(page.getByText(/고정 3\/3/u)).toBeVisible()
    expect(await page.getByRole('row').count()).toBe(4) // 헤더 1 + 데이터 3
    await expect(page.getByRole('row').filter({ hasText: TITLE_A })).toHaveCount(1)
    await expect(page.getByRole('row').filter({ hasText: TITLE_B })).toHaveCount(0)
    await page.screenshot({ path: path.join(SHOT_DIR, 'news-pin-filter.png'), fullPage: true })
  } finally {
    /* 뒷정리 — 테스트 글만 지운다. 실제 글의 고정 상태는 애초에 바꾸지 않았다. */
    const url = localEnv.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = localEnv.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(url!, serviceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    await supabase.from('posts').delete().eq('board', 'news').in('title', [TITLE_A, TITLE_B])
  }
})
