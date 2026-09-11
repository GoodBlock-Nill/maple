import { readFileSync } from 'node:fs'

import { expect, test } from '@playwright/test'

import type { Page } from '@playwright/test'

/**
 * 마이페이지 v2 (계정 관리 · 계정 연동).
 *
 * 시안(Figma 2UmKcpmy55IqMZ7Sg6vTeW · 166:13113 · 166:13195)은 1440 과 375 두 폭이
 * 있다. 좌표 검증은 1440 에서만 하고, 폰(390)에서는 "시안 골격이 서는가 · 잘리지
 * 않는가"를 본다.
 *
 * 기준값 근거는 `docs/reference/figma/mypage-v2-spec.md` 와 시안 PNG 실측이다.
 */

const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }

/**
 * 한 번 만든 로그인 쿠키를 담아 두는 자리(`/test-results` 는 gitignore 대상).
 *
 * **프로젝트(브라우저)마다 다른 파일**이다. 스텁 로그인은 호출할 때마다 계정을 새로
 * 만들고 `signOut()` 은 리프레시 토큰을 전역 무효화하므로, 한 파일을 두 프로젝트가
 * 나눠 쓰면 한쪽의 로그아웃이 다른 쪽 세션을 끊는다.
 */
function storageStatePath(projectName: string): string {
  return `test-results/mypage-auth-${projectName.replace(/\W+/gu, '-')}.json`
}

/** 1440 기준 골격 — 시안 PNG 실측(±2). */
const LAYOUT = {
  titleY: 334,
  sidebarX: 120,
  sidebarW: 268,
  cardX: 420,
  cardY: 461,
  cardW: 900,
  cardH: 269,
  inputX: 444,
  inputW: 413,
  inputH: 54,
  buttonX: 868,
  buttonW: 99,
  marketingBoxY: 811.5,
  marketingBoxH: 56,
  withdrawY: 931.6,
  footerPanelX: 120,
  footerPanelY: 1546,
  footerPanelW: 1200,
  footerPanelH: 353,
  foxX: 1080,
  foxW: 207,
}

/** 시안과 ±2px 안에서 같으면 통과로 본다(서브픽셀 반올림 여유). */
const TOLERANCE = 2

const TABS = ['계정 관리', '계정 연동'] as const

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

function expectNear(actual: number, expected: number, label: string) {
  expect(Math.abs(actual - expected), `${label}: ${actual} ≠ ${expected}`).toBeLessThanOrEqual(
    TOLERANCE,
  )
}

test.describe('마이페이지 (비로그인)', () => {
  test('should send anonymous visitors to login', async ({ page }) => {
    // Arrange & Act
    await page.goto('/account')

    // Assert
    await expect(page).toHaveURL(/\/login/u)
  })

  test('should keep the v1 tabs alive as redirects', async ({ page }) => {
    // Arrange & Act — 쿠폰·문의내역 경로는 사라졌다(프록시가 /account 로 302).
    await page.goto('/account/coupon')

    // Assert — 미로그인이라 그 다음 관문(로그인)까지 이어진다.
    await expect(page).toHaveURL(/\/login\?next=%2Faccount/u)

    // Act
    await page.goto('/account/inquiries')

    // Assert
    await expect(page).toHaveURL(/\/login\?next=%2Faccount/u)
  })
})

/**
 * 로그인 세션은 **한 번만** 만든다.
 *
 * 스텁 간편로그인은 호출할 때마다 계정을 새로 만들어서(`stub-social.ts`), 테스트마다
 * 로그인하면 Supabase 의 가입 빈도 제한에 걸려 무작위로 실패한다. 한 번 로그인해
 * 쿠키를 저장하고 나머지 테스트가 그 상태로 시작한다.
 *
 * 로그아웃 테스트가 **맨 마지막**인 이유도 같다 — `signOut()` 은 리프레시 토큰을
 * 전역으로 무효화해서, 저장해 둔 쿠키가 그 뒤로는 쓸 수 없다.
 */
test.describe('마이페이지', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser }, testInfo) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await stubLogin(page, '/account')
    await context.storageState({ path: storageStatePath(testInfo.project.name) })
    await context.close()
  })

  /* 쿠키는 테스트마다 직접 심는다 — `test.use({ storageState })` 는 고정 문자열만
     받아서 프로젝트별 파일을 가리킬 수 없다. */
  test.beforeEach(async ({ context }, testInfo) => {
    const saved = readFileSync(storageStatePath(testInfo.project.name), 'utf8')
    await context.addCookies(JSON.parse(saved).cookies)
  })

  test('should place the 계정 관리 blocks on the Figma grid at 1440', async ({ page }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)
    await page.goto('/account')

    // Act
    const title = await boxOf(page, 'main h1')
    const sidebar = await boxOf(page, 'nav[aria-label="마이페이지 메뉴"]')
    const card = await boxOf(page, 'section[aria-label="계정 관리"]')
    const input = await boxOf(page, '#account-nickname')
    const button = await boxOf(page, 'section[aria-label="계정 관리"] button[type="submit"]')
    const marketing = await boxOf(page, 'section[aria-labelledby="marketing-heading"] label')
    const withdraw = await boxOf(page, 'section[aria-label="회원 탈퇴"]')

    // Assert
    await expect(page.getByRole('heading', { name: '마이페이지', level: 1 })).toBeVisible()
    expectNear(title.y, LAYOUT.titleY, '제목 y')
    expectNear(sidebar.x, LAYOUT.sidebarX, '사이드바 x')
    expectNear(sidebar.width, LAYOUT.sidebarW, '사이드바 폭')
    expectNear(card.x, LAYOUT.cardX, '카드 x')
    expectNear(card.y, LAYOUT.cardY, '카드 y')
    expectNear(card.width, LAYOUT.cardW, '카드 폭')
    expectNear(card.height, LAYOUT.cardH, '카드 높이')
    expectNear(input.x, LAYOUT.inputX, '닉네임 입력 x')
    expectNear(input.width, LAYOUT.inputW, '닉네임 입력 폭')
    expectNear(input.height, LAYOUT.inputH, '닉네임 입력 높이')
    expectNear(button.x, LAYOUT.buttonX, '변경하기 x')
    expectNear(button.width, LAYOUT.buttonW, '변경하기 폭')
    expectNear(marketing.y, LAYOUT.marketingBoxY, '마케팅 박스 y')
    expectNear(marketing.height, LAYOUT.marketingBoxH, '마케팅 박스 높이')
    expectNear(withdraw.y, LAYOUT.withdrawY, '회원 탈퇴 행 y')

    await expectNoHorizontalOverflow(page)
  })

  test('should show the two v2 tabs and move between them', async ({ page }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)
    await page.goto('/account')
    const nav = page.locator('nav[aria-label="마이페이지 메뉴"]')

    // Assert — 두 탭이 시안 순서로 있고 "계정 연동"에는 준비중 배지가 붙어 있다.
    await expect(nav.getByRole('link')).toHaveCount(2)
    await expect(nav.getByRole('link').nth(0)).toHaveText(TABS[0])
    await expect(nav.getByRole('link').nth(1)).toContainText(TABS[1])
    await expect(nav.getByText('준비중')).toBeVisible()
    await expect(nav.getByRole('link', { name: '계정 관리' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    // Act
    await nav.getByRole('link').nth(1).click()
    await page.waitForURL('**/account/link')

    // Assert
    await expect(page.getByLabel('글자월드 계정 UID')).toBeVisible()
    await expect(nav.getByRole('link').nth(1)).toHaveAttribute('aria-current', 'page')
    await expect(nav.getByRole('link', { name: '계정 관리' })).not.toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('should not keep the v1 cards on the 계정 관리 tab', async ({ page }) => {
    // Arrange & Act
    await page.setViewportSize(DESKTOP)
    await page.goto('/account')

    // Assert — 아바타·이름·비밀번호·쿠폰·문의내역은 v2 에서 전부 빠졌다.
    await expect(page.getByLabel('닉네임')).toBeVisible()
    await expect(page.getByLabel('이메일')).toHaveAttribute('readonly', '')
    await expect(page.getByRole('heading', { name: '프로필' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: '비밀번호 변경' })).toHaveCount(0)
    await expect(page.getByLabel('이름')).toHaveCount(0)
    await expect(page.getByRole('link', { name: '쿠폰' })).toHaveCount(0)
  })

  test('should change the nickname inline', async ({ page }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)
    await page.goto('/account')
    const nickname = `e2e${Math.random().toString(36).slice(2, 8)}`

    // Act
    await page.getByLabel('닉네임').fill(nickname)
    await page.getByRole('button', { name: '변경하기' }).click()

    // Assert — 안내는 입력 아래 한 줄이고, 헤더 메뉴의 이름도 함께 바뀐다.
    await expect(page.getByText('닉네임을 변경했습니다.')).toBeVisible()
    await expect(page.locator('#site-desktop-auth')).toContainText(nickname)
  })

  test('should explain a nickname that breaks the rule', async ({ page }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)
    await page.goto('/account')

    // Act — 공백은 허용 문자가 아니다(온보딩과 같은 규칙).
    await page.getByLabel('닉네임').fill('모 험가')
    await page.getByRole('button', { name: '변경하기' }).click()

    // Assert — 오류는 입력 바로 아래 자리에 붙는다(#{필드}-error).
    await expect(page.locator('#account-nickname-error')).toContainText('닉네임은')
  })

  test('should confirm the marketing consent with a modal', async ({ page }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)
    await page.goto('/account')
    const checkbox = page.getByRole('checkbox', { name: '마케팅 정보 수신 동의' })
    /* 진짜 체크박스는 sr-only 라 화면에서는 라벨(박스 전체)을 누른다 — 사용자와
       같은 경로다. */
    const box = page.locator('section[aria-labelledby="marketing-heading"] label')

    if (await checkbox.isChecked()) {
      await box.click()
      await expect(checkbox).not.toBeChecked()
      await expect(page.getByRole('dialog')).toHaveCount(0)
    }

    // Act
    await box.click()

    // Assert
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('마케팅 정보 수신에 동의되었습니다.')

    // Act — 확인을 누르면 닫히고 체크는 남는다.
    await dialog.getByRole('button', { name: '확인' }).click()

    // Assert
    await expect(dialog).toHaveCount(0)
    await expect(checkbox).toBeChecked()
    await page.reload()
    await expect(page.getByRole('checkbox', { name: '마케팅 정보 수신 동의' })).toBeChecked()
  })

  test('should lock the 계정 연동 form while the world-account flag is off', async ({ page }) => {
    // Arrange & Act
    await page.setViewportSize(DESKTOP)
    await page.goto('/account/link')

    // Assert
    await expect(page.getByText('월드 계정 연동은 준비 중입니다.')).toBeVisible()
    await expect(page.getByLabel('글자월드 계정 UID')).toBeDisabled()
    await expect(page.getByLabel('글자월드 프로필 코드')).toBeDisabled()
    await expect(page.getByRole('button', { name: '계정 연동하기' })).toBeDisabled()

    /* 카드·구분선·탈퇴 블록의 x·폭은 계정 관리 탭과 같은 격자다. */
    const card = await boxOf(page, 'section[aria-label="계정 연동"]')
    expectNear(card.x, LAYOUT.cardX, '카드 x')
    expectNear(card.y, LAYOUT.cardY, '카드 y')
    expectNear(card.width, LAYOUT.cardW, '카드 폭')

    await expectNoHorizontalOverflow(page)
  })

  test('should send the v1 tab paths back to /account', async ({ page }) => {
    // Arrange & Act
    await page.setViewportSize(DESKTOP)
    await page.goto('/account/coupon')

    // Assert
    await expect(page).toHaveURL(/\/account$/u)

    // Act
    await page.goto('/account/inquiries')

    // Assert
    await expect(page).toHaveURL(/\/account$/u)
  })

  test('should draw the mypage footer panel, links and the animated fox', async ({ page }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)
    await page.goto('/account')

    // Act
    const panel = await boxOf(page, 'footer div.rounded-panel')
    const fox = await boxOf(page, 'footer img[src$=".gif"]')

    // Assert — 패널 1200 @ x120(시안 §5), 여우 207 @ (1080, 570) + 푸터 상단.
    expectNear(panel.x, LAYOUT.footerPanelX, '푸터 패널 x')
    expectNear(panel.y, LAYOUT.footerPanelY, '푸터 패널 y')
    expectNear(panel.width, LAYOUT.footerPanelW, '푸터 패널 폭')
    expectNear(panel.height, LAYOUT.footerPanelH, '푸터 패널 높이')
    expectNear(fox.x, LAYOUT.foxX, '여우 x')
    expectNear(fox.width, LAYOUT.foxW, '여우 폭')
    /* next/image 최적화를 거치면 첫 프레임만 남는다(`unoptimized` 필수). */
    await expect(page.locator('footer img[src$=".gif"]')).toHaveAttribute(
      'src',
      '/images/mypage/mascot-footer.gif',
    )

    // Assert — 연락처는 알약이 아니라 텍스트 블록이고, Legal 에 마케팅 문서는 없다.
    const footer = page.locator('footer')
    await expect(footer.getByText('문의하기')).toBeVisible()
    await expect(footer.getByText('care@gjstory.com')).toBeVisible()
    await expect(footer.getByRole('navigation', { name: 'Legal' }).getByRole('link')).toHaveText([
      '개인정보처리방침',
      '디스코드 운영정책',
      '글자월드 운영정책',
    ])
  })

  test('should stack the phone layout without clipping', async ({ page }) => {
    // Arrange
    await page.setViewportSize(PHONE)
    await page.goto('/account')

    // Assert — 사이드바 대신 카드 상단 세그먼트 탭(시안 §6).
    await expect(page.locator('nav[aria-label="마이페이지 메뉴"]')).toBeHidden()
    const tabs = page.locator('nav[aria-label="마이페이지 탭"]')
    await expect(tabs).toBeVisible()
    await expect(tabs.getByRole('link')).toHaveCount(2)

    const card = await boxOf(page, 'section[aria-label="계정 관리"]')
    expectNear(card.x, 16, '카드 x')
    expectNear(card.y, 278, '카드 y')

    await expectNoHorizontalOverflow(page)

    // Act & Assert
    await page.goto('/account/link')
    await expect(page.locator('nav[aria-label="마이페이지 탭"]')).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  /** signOut 은 리프레시 토큰을 전역 무효화한다 — 이 describe 의 **마지막** 테스트여야 한다. */
  test('should log out from the header dropdown', async ({ page }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)
    await page.goto('/account')
    const trigger = page.locator('#site-desktop-auth button').first()

    // Act
    await trigger.click()

    // Assert — 현재 페이지가 마이페이지라 그 항목이 강조된다.
    const menu = page.getByRole('menu')
    await expect(menu.getByRole('menuitem', { name: '마이페이지' })).toHaveAttribute(
      'href',
      '/account',
    )

    // Act
    await menu.getByRole('menuitem', { name: '로그아웃' }).click()

    // Assert — 홈으로 나가고 헤더는 다시 "로그인" 하나가 된다.
    await page.waitForURL('**/')
    await expect(
      page.locator('#site-desktop-auth').getByRole('link', { name: '로그인' }),
    ).toBeVisible()
  })
})

/**
 * 회원 탈퇴 — 자기 계정을 지우는 흐름이라 **전용 계정**으로 돈다(위 describe 의
 * 세션을 쓰면 나머지 테스트가 탈퇴 대기 상태로 바뀐다).
 */
test.describe('회원 탈퇴', () => {
  test('should confirm the withdrawal with a modal on the way home', async ({ page }) => {
    // Arrange
    await stubLogin(page, '/account')
    await page.setViewportSize(DESKTOP)

    // Act — 행의 빨간 트리거 → 기존 확인 모달 → 탈퇴.
    await page.locator('section[aria-label="회원 탈퇴"]').getByRole('button').click()
    await expect(page.getByRole('dialog')).toContainText('탈퇴 후 90일')
    await page.getByRole('button', { name: '탈퇴', exact: true }).click()

    // Assert — 홈으로 나가면서 완료 모달이 뜬다(배너가 아니다).
    await page.waitForURL(/notice=withdrawn/u)
    const done = page.getByRole('dialog')
    await expect(done).toContainText('회원 탈퇴가 완료되었습니다.')

    // Act — 확인을 누르면 주소에서 파라미터가 사라진다.
    await done.getByRole('button', { name: '확인' }).click()

    // Assert
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page).not.toHaveURL(/notice=withdrawn/u)
  })
})
