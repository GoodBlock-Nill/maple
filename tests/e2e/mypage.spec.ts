import { expect, test } from '@playwright/test'

import { createServiceClient } from './service-role'

import type { Page } from '@playwright/test'

/**
 * 마이페이지(계정 관리 · 쿠폰 · 문의내역).
 *
 * 시안(Figma 2041:2958 · 2041:3128 · 2041:3237)은 1440 한 폭만 있으므로 좌표 검증은
 * 1440 에서만 한다. 폰(390)에서는 "잘리지 않는가"만 본다.
 *
 * 기준값 근거는 `docs/reference/figma/mypage-spec.md` 와 시안 PNG 실측이다.
 */

const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }

/** 한 번 만든 로그인 쿠키를 담아 두는 자리(`/test-results` 는 gitignore 대상). */
const STORAGE_STATE = 'test-results/mypage-auth.json'

/** 1440 기준 골격 — 제목 블록 y, 사이드바 x/폭, 첫 카드 x/y/폭. */
const LAYOUT = {
  titleY: 334,
  sidebarX: 120,
  sidebarW: 268,
  cardX: 420,
  cardY: 462,
  cardW: 900,
}

/** 시안과 ±2px 안에서 같으면 통과로 본다(서브픽셀 반올림 여유). */
const TOLERANCE = 2

const TABS = ['계정 관리', '쿠폰', '문의내역'] as const

/** 마이그레이션 시드에 들어 있는 샘플 쿠폰(평소에는 꺼져 있다). */
const SAMPLE_COUPON_CODE = 'GLZA-TEST-0001'

function randomDigits(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('')
}

async function fillIfPresent(page: Page, name: string, value: string): Promise<void> {
  const field = page.locator(`input[name="${name}"]`)

  if ((await field.count()) > 0) {
    await field.fill(value)
  }
}

/**
 * 스텁 간편로그인 + 온보딩.
 *
 * 버튼은 라벨이 아니라 `name`/`value` 로 고른다 — 시안 문구("Google로 계속하기")가
 * 바뀌어도 흐름 테스트가 함께 깨지지 않게 한다.
 */
async function stubLogin(page: Page, nextPath: string): Promise<void> {
  await page.goto(`/login?next=${encodeURIComponent(nextPath)}`)
  await page.locator('button[name="provider"][value="google"]').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))

  if (page.url().includes('/auth/onboarding')) {
    const suffix = Math.random().toString(36).slice(2, 10)

    await fillIfPresent(page, 'nickname', `e2e${suffix}`)
    await fillIfPresent(page, 'mswUid', `2012${randomDigits(13)}`)
    await fillIfPresent(page, 'mswProfileCode', `#${suffix}`)
    await page.locator('input[name="termsAgreed"]').check()
    await page.locator('input[name="privacyAgreed"]').check()
    await page.locator('input[name="ageConfirmed"]').check()
    await page.getByRole('button', { name: '시작하기' }).click()
  }

  await page.waitForURL(`**${nextPath}`)
}

async function boxOf(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox()
  expect(box, `${selector} 를 찾지 못했다`).not.toBeNull()

  return box as { x: number; y: number; width: number; height: number }
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )

  expect(overflow).toBeLessThanOrEqual(0)
}

test.describe('마이페이지 (비로그인)', () => {
  test('should send anonymous visitors to login', async ({ page }) => {
    // Arrange & Act
    await page.goto('/account')

    // Assert
    await expect(page).toHaveURL(/\/login/)
  })
})

/**
 * 로그인 세션은 **한 번만** 만든다.
 *
 * 스텁 간편로그인은 호출할 때마다 계정을 새로 만들어서(`stub-social.ts`), 테스트마다
 * 로그인하면 Supabase 의 가입 빈도 제한에 걸려 무작위로 실패한다. 한 번 로그인해
 * 쿠키를 저장하고 나머지 테스트가 그 상태로 시작한다.
 */
test.describe('마이페이지', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: STORAGE_STATE })

  test.beforeAll(async ({ browser }) => {
    /* `browser.newContext()` 는 이 describe 의 `use` 옵션을 물려받는다. 아직 없는
       파일을 읽으려 하지 않도록 여기서만 storageState 를 끈다. */
    const context = await browser.newContext({ storageState: undefined })
    const page = await context.newPage()

    await stubLogin(page, '/account')
    await context.storageState({ path: STORAGE_STATE })
    await context.close()
  })

  test('should place the title, sidebar and first card on the Figma grid at 1440', async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)
    await page.goto('/account')

    // Act
    const title = await boxOf(page, 'main h1')
    const sidebar = await boxOf(page, 'main nav[aria-label="마이페이지 메뉴"]')
    const card = await boxOf(page, 'main section')

    // Assert
    await expect(page.getByRole('heading', { name: '마이페이지', level: 1 })).toBeVisible()
    expect(Math.abs(title.y - LAYOUT.titleY)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(sidebar.x - LAYOUT.sidebarX)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(sidebar.width - LAYOUT.sidebarW)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(card.x - LAYOUT.cardX)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(card.y - LAYOUT.cardY)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(card.width - LAYOUT.cardW)).toBeLessThanOrEqual(TOLERANCE)

    await expectNoHorizontalOverflow(page)
  })

  test('should show the three tabs and move between them', async ({ page }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)
    await page.goto('/account')
    const nav = page.locator('nav[aria-label="마이페이지 메뉴"]')

    // Assert — 세 탭이 시안 순서로 있고 지금은 "계정 관리"가 켜져 있다.
    await expect(nav.getByRole('link')).toHaveText([...TABS])
    await expect(nav.getByRole('link', { name: '계정 관리' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    // Act — 쿠폰 탭
    await nav.getByRole('link', { name: '쿠폰' }).click()
    await page.waitForURL('**/account/coupon')

    // Assert — 아래 "쿠폰 등록 내역" 카드와 이름이 겹치므로 정확히 일치시킨다.
    await expect(page.getByRole('heading', { name: '쿠폰 등록', exact: true })).toBeVisible()
    await expect(nav.getByRole('link', { name: '쿠폰' })).toHaveAttribute('aria-current', 'page')
    await expect(nav.getByRole('link', { name: '계정 관리' })).not.toHaveAttribute(
      'aria-current',
      'page',
    )

    // Act — 문의내역 탭
    await nav.getByRole('link', { name: '문의내역' }).click()
    await page.waitForURL('**/account/inquiries')

    // Assert
    await expect(page.getByRole('heading', { name: '문의 내역' })).toBeVisible()
    await expect(nav.getByRole('link', { name: '문의내역' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('should keep the account cards and the withdraw block on the 계정 관리 tab', async ({
    page,
  }) => {
    // Arrange & Act
    await page.setViewportSize(DESKTOP)
    await page.goto('/account')

    // Assert
    await expect(page.getByRole('heading', { name: '프로필' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '마케팅 수신 설정' })).toBeVisible()
    await expect(page.getByRole('button', { name: '홈페이지 회원 탈퇴' })).toBeVisible()
    /* 스텁 로그인은 간편로그인 계정이라 비밀번호 카드 자체가 없다 — 바꿀 비밀번호가
       없는 계정에 빈 카드를 남기지 않는다(2026-09-10 로그인 개편). */
    await expect(page.getByRole('heading', { name: '비밀번호 변경' })).toHaveCount(0)
  })

  test('should explain a bad coupon code and a bad world uid in Korean', async ({ page }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)
    await page.goto('/account/coupon')

    const code = page.locator('input[name="code"]')
    const uid = page.locator('input[name="mswUid"]')
    const profileCode = page.locator('input[name="mswProfileCode"]')
    const submit = page.getByRole('button', { name: '쿠폰 등록' })

    /* 월드 UID·프로필 코드는 계정마다 유일해야 한다(RPC 가 쿠폰보다 먼저 본다).
       실행마다 다른 값을 써야 "이미 다른 계정에 연결된 …" 으로 새지 않는다. */
    const freshUid = () => `2012${randomDigits(13)}`
    const freshProfileCode = `#e2e${Math.random().toString(36).slice(2, 7)}`

    // Act — 형식이 어긋난 코드
    await code.fill('AB')
    await uid.fill(freshUid())
    await profileCode.fill(freshProfileCode)
    await submit.click()

    // Assert
    await expect(
      page.getByText('쿠폰 코드를 다시 확인해 주세요. (예: GLZA-TEST-0001)'),
    ).toBeVisible()

    // Act — UID 형식 오류
    await code.fill('GLZA-TEST-0001')
    await uid.fill('123')
    await submit.click()

    // Assert
    await expect(
      page.getByText('UID는 숫자 10~20자로 입력해 주세요. (예: 20123000000000000)'),
    ).toBeVisible()

    // Act — 형식은 맞지만 존재하지 않는 코드(실제 RPC 까지 간다)
    await uid.fill(freshUid())
    await code.fill(`GLZA-E2E-${randomDigits(4)}`)
    await submit.click()

    // Assert
    await expect(page.getByText('존재하지 않거나 사용할 수 없는 쿠폰 코드입니다.')).toBeVisible()
  })

  test('should explain what the coupon history is before anything is registered', async ({
    page,
  }) => {
    // Arrange & Act
    await page.setViewportSize(DESKTOP)
    await page.goto('/account/coupon')

    const card = page.locator('section[aria-labelledby="coupon-history-heading"]')

    // Assert — 빈 표 대신 "코드는 어디서 나오는가"를 알려 준다.
    await expect(page.getByRole('heading', { name: '쿠폰 등록 내역' })).toBeVisible()
    await expect(card.getByText('아직 등록한 쿠폰이 없습니다.')).toBeVisible()
    await expect(card.getByRole('button', { name: '쿠폰 코드 입력하기' })).toBeVisible()
    await expect(card.getByText(/운영팀 확인 후 게임 안에서 지급됩니다/u)).toBeVisible()
    /* 시안(§3)의 카드 골격을 그대로 쓴다 — 등록 카드와 같은 폭·같은 자리. */
    const box = await boxOf(page, 'section[aria-labelledby="coupon-history-heading"]')
    expect(Math.abs(box.x - LAYOUT.cardX)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(box.width - LAYOUT.cardW)).toBeLessThanOrEqual(TOLERANCE)
  })

  /**
   * 등록 → 내역 한 바퀴.
   *
   * 샘플 쿠폰을 잠깐 켜서 실제로 한 건 등록하고, 관리자만 적을 수 있는 상태
   * (지급 완료 · 거절)는 서비스 롤로 만들어 붙인다. 끝나면 만든 행을 지우고 쿠폰을
   * 원래의 비활성 상태로 되돌린다.
   *
   * chromium 에서만 돈다. 두 프로젝트가 동시에 같은 쿠폰을 켜고 끄면 한쪽이
   * `invalid_code` 를 만나 무작위로 실패한다 — 흐름 자체는 폭과 무관하다.
   */
  test('should list a registered coupon and open its details', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', '쿠폰 상태를 공유하므로 한 프로젝트에서만 돈다')

    const service = createServiceClient()
    test.skip(service === null, '.env.local 의 SUPABASE_SERVICE_ROLE_KEY 가 필요하다')

    // Arrange — 샘플 쿠폰을 잠깐 켠다.
    const { data: coupon } = await service!
      .from('coupons')
      .select('id, is_active')
      .eq('code', SAMPLE_COUPON_CODE)
      .maybeSingle()

    expect(coupon, `샘플 쿠폰 ${SAMPLE_COUPON_CODE} 가 없다`).not.toBeNull()
    await service!.from('coupons').update({ is_active: true }).eq('id', coupon!.id)

    const uid = `2012${randomDigits(13)}`

    try {
      await page.setViewportSize(DESKTOP)
      await page.goto('/account/coupon')

      // Act — 화면으로 실제 등록한다.
      await page.locator('input[name="code"]').fill(SAMPLE_COUPON_CODE)
      await page.locator('input[name="mswUid"]').fill(uid)
      await page
        .locator('input[name="mswProfileCode"]')
        .fill(`#e2e${Math.random().toString(36).slice(2, 7)}`)
      await page.getByRole('button', { name: '쿠폰 등록' }).click()

      // Assert — 성공 안내가 아래 카드로 시선을 넘기고, 새 줄이 강조된 채 열린다.
      await expect(page.getByText(/아래 “쿠폰 등록 내역”에서 처리 상태를 확인/u)).toBeVisible()

      const card = page.locator('section[aria-labelledby="coupon-history-heading"]')
      const table = card.locator('table')

      await expect(table.getByText('클라이언트 연동 테스트 쿠폰')).toBeVisible()
      await expect(table.getByText('****-****-0001')).toBeVisible()
      await expect(table.getByText('대기 중')).toBeVisible()
      await expect(card.locator('.coupon-row-new')).toHaveCount(2)
      /* 방금 등록한 줄은 펼친 채로 연다 — '대기 중'만으로는 언제 받는지 알 수 없다. */
      await expect(table.getByText('테스트 보상 (실제 지급 없음)')).toBeVisible()

      // Arrange — 관리자가 적는 두 상태를 붙인다.
      const { data: mine } = await service!
        .from('coupon_redemptions')
        .select('id, user_id')
        .eq('msw_uid', uid)
        .maybeSingle()

      expect(mine, '등록 이력이 만들어지지 않았다').not.toBeNull()

      await service!.from('coupon_redemptions').insert([
        {
          coupon_id: coupon!.id,
          user_id: mine!.user_id,
          msw_uid: uid,
          msw_profile_code: '#e2edeliv',
          status: 'delivered',
          processed_at: new Date().toISOString(),
        },
        {
          coupon_id: coupon!.id,
          user_id: mine!.user_id,
          msw_uid: uid,
          msw_profile_code: '#e2ereject',
          status: 'rejected',
          admin_note: '입력한 UID 계정을 찾을 수 없습니다.',
          processed_at: new Date().toISOString(),
        },
      ])

      // Act
      await page.reload()

      // Assert — 세 상태가 한 표에 선다.
      await expect(table.getByText('대기 중')).toBeVisible()
      await expect(table.getByText('지급 완료')).toBeVisible()
      await expect(table.getByText('거절')).toBeVisible()

      // Act — 거절 건을 펼친다.
      await table.getByRole('row').filter({ hasText: '거절' }).getByRole('button').click()

      // Assert — 사유와 물어볼 곳이 함께 있다.
      await expect(table.getByText('입력한 UID 계정을 찾을 수 없습니다.')).toBeVisible()
      await expect(table.getByRole('link', { name: '고객지원에 문의' })).toHaveAttribute(
        'href',
        '/support',
      )

      // Assert — 폰에서는 표 대신 카드로 눕고 가로 스크롤이 없다.
      await page.setViewportSize(PHONE)
      await expect(table).toBeHidden()
      await expect(
        card.getByRole('button', { name: /클라이언트 연동 테스트 쿠폰/u }).first(),
      ).toBeVisible()
      await expectNoHorizontalOverflow(page)
    } finally {
      await service!.from('coupon_redemptions').delete().eq('msw_uid', uid)
      await service!
        .from('coupons')
        .update({ is_active: coupon?.is_active ?? false })
        .eq('id', coupon!.id)
    }
  })

  test('should keep the animated fox in the footer as a gif image', async ({ page }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)
    await page.goto('/account')

    // Act — next/image 최적화를 거치면 첫 프레임만 남는다(`unoptimized` 필수).
    const mascot = page.locator('footer img[src$=".gif"]')

    // Assert
    await expect(mascot).toHaveAttribute('src', '/images/mypage/mascot-footer.gif')
    const box = await boxOf(page, 'footer img[src$=".gif"]')
    expect(Math.abs(box.width - 207)).toBeLessThanOrEqual(TOLERANCE)
  })

  test('should not overflow horizontally on a phone', async ({ page }) => {
    // Arrange
    await page.setViewportSize(PHONE)
    await page.goto('/account')

    // Act & Assert
    await expectNoHorizontalOverflow(page)

    for (const path of ['/account/coupon', '/account/inquiries']) {
      await page.goto(path)
      await expectNoHorizontalOverflow(page)
    }
  })
})
