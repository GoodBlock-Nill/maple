import { readFileSync } from 'node:fs'
import path from 'node:path'

import { createClient } from '@supabase/supabase-js'
import { expect, test, type Page } from '@playwright/test'

/**
 * 가이드 · 랭킹 · 사이트 설정 · 감사 로그 인수 검증.
 *
 * 자격 증명은 저장소에 두지 않는다. 스크래치패드의 env 파일에서 **테스트 안에서만**
 * 읽는다(tests/e2e/admin.spec.ts 와 같은 규약).
 *
 * 순서가 있다(`describe.serial`). 감사 로그 검증은 앞선 세 모듈이 남긴 기록을 보고,
 * 정리(cleanup)는 마지막에 한 번에 한다.
 */

const SECRETS_PATH =
  process.env.ADMIN_E2E_SECRETS ??
  '/private/tmp/claude-501/-Users-goodblock-Projects-maple/61a98c42-b684-4d24-8c7f-385f43df2325/scratchpad/admin-bootstrap.env'

const SHOT_DIR =
  process.env.ADMIN_E2E_SHOTS ??
  '/private/tmp/claude-501/-Users-goodblock-Projects-maple/61a98c42-b684-4d24-8c7f-385f43df2325/scratchpad/verify'

const CLIENT_URL = process.env.CLIENT_E2E_BASE_URL ?? 'http://localhost:3000'

const E2E_PREFIX = '[E2E]'
const E2E_ITEM_NAME = `${E2E_PREFIX} 아이템`
const E2E_CHARACTER_PREFIX = 'E2E테스터'
const E2E_SLOGAN = `${E2E_PREFIX} 슬로건`

/** 스냅샷 한 벌(5행). 직업군은 DB enum 그대로 넣는다 — 추정 로직은 관리자에 없다. */
const RANKING_SEED = [
  { level: 212, job: '비숍', jobGroup: 'adventurer' as const, guild: '글자월드', exp: '98.7B' },
  { level: 211, job: '플레임위자드', jobGroup: 'cygnus' as const, guild: '글자월드', exp: '98.4B' },
  { level: 210, job: '배틀메이지', jobGroup: 'resistance' as const, guild: null, exp: '98.1B' },
  { level: 209, job: '아란', jobGroup: 'hero' as const, guild: '달빛단', exp: '97.8B' },
  { level: 208, job: '데몬슬레이어', jobGroup: 'demon' as const, guild: null, exp: '97.5B' },
]

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

/** 정리는 화면을 거치지 않는다 — 테스트가 중간에 깨져도 시드 상태로 되돌려야 한다. */
function serviceClient() {
  return createClient(
    localEnv.NEXT_PUBLIC_SUPABASE_URL ?? '',
    localEnv.SUPABASE_SERVICE_ROLE_KEY ?? '',
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  )
}

async function signIn(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('이메일').fill(ADMIN_EMAIL)
  await page.getByLabel('비밀번호').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible()
}

/**
 * 랭킹 스냅샷 적재를 흉내 낸다.
 *
 * 스냅샷은 개발팀 연동(게임 데이터)이 넣는다 — 관리자 화면에는 적재 수단이 없다.
 * 그래서 되돌리기를 검사하려면 테스트가 연동 자리를 대신해 두 벌을 심어야 한다.
 */
async function seedSnapshot(snapshotAt: string, suffix: string): Promise<void> {
  const rows = RANKING_SEED.map((seed, index) => ({
    rank_type: 'total' as const,
    snapshot_at: snapshotAt,
    rank: index + 1,
    character_name: `${E2E_CHARACTER_PREFIX}${suffix}${index + 1}`,
    level: seed.level,
    job: seed.job,
    job_group: seed.jobGroup,
    guild: seed.guild,
    exp: seed.exp,
    avatar_url: null,
  }))

  const { error } = await serviceClient().from('rankings').insert(rows)

  expect(error, '랭킹 스냅샷을 심지 못했습니다').toBeNull()
}

test.describe.configure({ mode: 'serial' })

let originalSlogan: string | null = null

test.beforeAll(async () => {
  expect(ADMIN_EMAIL, '관리자 계정 정보를 읽지 못했습니다').toBeTruthy()
  expect(localEnv.SUPABASE_SERVICE_ROLE_KEY, '.env.local 에 서비스 롤 키가 필요합니다').toBeTruthy()

  const { data } = await serviceClient()
    .from('site_settings')
    .select('creator_slogan')
    .eq('id', 1)
    .maybeSingle()
  originalSlogan = data?.creator_slogan ?? null
})

test.afterAll(async () => {
  const supabase = serviceClient()

  // 1) 가이드: E2E 로 만든 아이템 전부
  await supabase.from('gacha_items').delete().like('name', `${E2E_PREFIX}%`)
  // 2) 랭킹: E2E 캐릭터가 들어간 스냅샷 통째로(시드 스냅샷이 다시 최신이 된다)
  const { data: e2eRows } = await supabase
    .from('rankings')
    .select('snapshot_at')
    .like('character_name', `${E2E_CHARACTER_PREFIX}%`)

  const snapshots = [...new Set((e2eRows ?? []).map((row) => row.snapshot_at))]

  if (snapshots.length > 0) {
    await supabase.from('rankings').delete().in('snapshot_at', snapshots)
  }

  // 3) 설정: 원래 슬로건으로 복구
  await supabase.from('site_settings').update({ creator_slogan: originalSlogan }).eq('id', 1)
})

test('가이드: 아이템 생성이 사용자 사이트까지 이어지고 삭제까지 돌아온다', async ({ page }) => {
  await signIn(page)
  await page.goto('/gacha?tab=premium')
  // 사이드바에도 같은 이름의 링크가 있다. 본문 도구 모음의 버튼을 눌러야 탭이 유지된다.
  await page.getByRole('main').getByRole('link', { name: '새 아이템' }).click()
  await expect(page.getByRole('heading', { name: '새 확률형 아이템' })).toBeVisible()

  await page.getByLabel('이름').fill(E2E_ITEM_NAME)
  await page.getByLabel('대표 확률 (%)').fill('1.234')
  await page.getByLabel('아이콘 주소').fill('/images/guide/icon-item-1.png')
  await page.getByRole('button', { name: '행 추가' }).click()
  await page.getByLabel('1행 등급').selectOption('SS')
  await page.getByLabel('1행 아이템명').fill('E2E 보상')
  await page.getByLabel('1행 확률').fill('0.05')

  // 미리보기는 사용자 사이트와 같은 표기를 써야 한다(카드는 소수 둘째 자리).
  await expect(page.getByLabel('사용자 사이트 미리보기')).toContainText('1.23%')
  await expect(page.getByLabel('사용자 사이트 미리보기')).toContainText('[SS등급]')

  await page.getByRole('button', { name: '저장' }).click()

  await expect(page).toHaveURL(/\/gacha\?tab=premium/)
  await expect(page.getByText(E2E_ITEM_NAME)).toBeVisible()
  await expect(page.getByText('1.234')).toBeVisible()
  await page.screenshot({ path: path.join(SHOT_DIR, 'admin-gacha.png'), fullPage: true })

  /* 사용자 사이트 확인. 목록은 60초 캐시(unstable_cache)라 방금 만든 항목이 바로
     보이지 않을 수 있는데, 검색어가 캐시 키에 들어가므로 새 검색어는 항상 DB 를
     다시 읽는다. */
  const guide = await page.request.get(
    `${CLIENT_URL}/guide?tab=premium&q=${encodeURIComponent(E2E_ITEM_NAME)}`,
  )
  expect(guide.status()).toBe(200)
  expect(await guide.text()).toContain(E2E_ITEM_NAME)

  // 삭제: 확인 다이얼로그를 한 번 거친 뒤 목록에서 사라진다.
  await page.goto('/gacha?tab=premium&q=' + encodeURIComponent(E2E_PREFIX))
  await page.locator('tr', { hasText: E2E_ITEM_NAME }).getByRole('button', { name: '삭제' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '삭제' }).click()
  await expect(page.getByText(`${E2E_ITEM_NAME}을 삭제했습니다.`)).toBeVisible()
  await expect(page.getByText(E2E_ITEM_NAME)).toHaveCount(0)
})

test('랭킹: 현재 스냅샷 확인과 이전 스냅샷 되돌리기가 동작한다', async ({ page }) => {
  /* 적재는 개발팀 연동의 몫이라 화면에 수단이 없다. 두 벌을 심어 "지금 사이트에
     보이는 표"와 "되돌릴 수 있는 표"를 만든다. */
  const olderAt = new Date(Date.now() - 60_000).toISOString()
  const newerAt = new Date().toISOString()

  await seedSnapshot(olderAt, 'A')
  await seedSnapshot(newerAt, 'B')

  await signIn(page)
  await page.goto('/rankings?type=total')

  // 최신 스냅샷이 곧 사용자 사이트가 읽는 표다.
  await expect(page.getByRole('heading', { name: '현재 스냅샷' })).toBeVisible()
  for (let rank = 1; rank <= 5; rank += 1) {
    await expect(page.getByText(`${E2E_CHARACTER_PREFIX}B${rank}`)).toBeVisible()
  }
  await page.screenshot({ path: path.join(SHOT_DIR, 'admin-rankings.png'), fullPage: true })

  /* 사용자 사이트는 최신 스냅샷만 읽는다. 닉네임은 앞 3자만 남기고 마스킹된다. */
  const ranking = await page.request.get(
    `${CLIENT_URL}/ranking?q=${encodeURIComponent(E2E_CHARACTER_PREFIX)}`,
  )
  expect(ranking.status()).toBe(200)
  expect(await ranking.text()).toContain('E2E***')

  /* 이력의 첫 줄은 현재 스냅샷이라 되돌리기 버튼이 없다. 그 다음 줄이 방금 심은
     이전 스냅샷이다. */
  const history = page.getByRole('table', { name: '랭킹 스냅샷 이력' })
  await expect(history.getByText('현재')).toBeVisible()

  // 과거 스냅샷을 열면 "사이트에 보이는 표가 아니다"라고 알려 준다.
  await history.getByRole('link', { name: '보기' }).nth(1).click()
  await expect(page.getByRole('heading', { name: '과거 스냅샷' })).toBeVisible()
  await expect(page.getByText(`${E2E_CHARACTER_PREFIX}A1`)).toBeVisible()
  await page.getByRole('link', { name: '현재 스냅샷 보기' }).click()

  await history.getByRole('button', { name: '되돌리기' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: '되돌리기' }).click()
  await expect(page.getByText('5건을 되돌렸습니다.')).toBeVisible()

  /* 되돌리기는 이력을 고쳐 쓰지 않는다 — 같은 내용의 **새 스냅샷**이 최신이 된다. */
  await page.goto('/rankings?type=total')
  await expect(page.getByRole('heading', { name: '현재 스냅샷' })).toBeVisible()
  for (let rank = 1; rank <= 5; rank += 1) {
    await expect(page.getByText(`${E2E_CHARACTER_PREFIX}A${rank}`)).toBeVisible()
  }

  const { data: latest } = await serviceClient()
    .from('rankings')
    .select('snapshot_at')
    .eq('rank_type', 'total')
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  expect(latest?.snapshot_at).not.toBe(newerAt)
})

test('사이트 설정: 저장과 연동 표시가 함께 동작한다', async ({ page }) => {
  await signIn(page)
  await page.goto('/settings')

  const slogan = page.getByTestId('creator-slogan-input')
  await slogan.fill(E2E_SLOGAN)
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('사이트 설정을 저장했습니다.')).toBeVisible()

  await page.reload()
  await expect(page.getByTestId('creator-slogan-input')).toHaveValue(E2E_SLOGAN)

  /* 슬로건은 아직 사용자 사이트가 읽지 않는다(components/about/CreatorPanel.tsx 가
     lib/mock/site.ts 의 상수를 쓴다). 화면이 그 사실을 알려 주는지까지가 이 모듈의
     책임이다 — 사용자 사이트 코드는 이 작업의 범위가 아니다. */
  const sloganField = page.locator('div.relative', {
    has: page.getByTestId('creator-slogan-input'),
  })
  await expect(sloganField.getByText('미연동')).toBeVisible()

  const about = await page.request.get(`${CLIENT_URL}/about`)
  expect(about.status()).toBe(200)

  // 실제로 연동된 값(월드 ID)은 사용자 사이트의 리다이렉트에 곧바로 쓰인다.
  await expect(
    page.locator('div.relative', { has: page.getByLabel('월드 ID') }).getByText('사이트 반영'),
  ).toBeVisible()

  await page.screenshot({ path: path.join(SHOT_DIR, 'admin-settings.png'), fullPage: true })
})

test('감사 로그: 앞선 조작이 한국어 행동명으로 남는다', async ({ page }) => {
  await signIn(page)
  await page.goto('/audit')

  await expect(page.getByRole('heading', { name: '감사 로그' })).toBeVisible()

  /* 행동 이름은 필터 드롭다운에도 나온다. 표로 범위를 좁혀야 "목록에 남았는지"를
     실제로 확인하는 검사가 된다. */
  const logs = page.getByRole('table', { name: '감사 로그 목록' })
  await expect(logs.getByText('확률형 아이템 등록').first()).toBeVisible()
  await expect(logs.getByText('확률형 아이템 삭제').first()).toBeVisible()
  await expect(logs.getByText('랭킹 스냅샷 되돌리기').first()).toBeVisible()
  await expect(logs.getByText('사이트 설정 수정').first()).toBeVisible()

  // 펼치면 변경 전후 전체가 보인다.
  await logs.getByText('자세히').first().click()
  await expect(logs.getByText('변경 후').first()).toBeVisible()

  await page.screenshot({ path: path.join(SHOT_DIR, 'admin-audit.png'), fullPage: true })

  // 필터도 URL 로 동작한다.
  await page.goto('/audit?table=gacha_items')
  await expect(
    page.getByRole('table', { name: '감사 로그 목록' }).getByText('확률형 아이템').first(),
  ).toBeVisible()
})
