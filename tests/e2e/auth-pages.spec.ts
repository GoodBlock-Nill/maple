import { expect, test } from '@playwright/test'

/**
 * 로그인·회원가입·비밀번호 찾기 화면.
 *
 * 시안(Figma 2041:2289 · 2041:2365)은 1440 한 폭만 있으므로 좌표 검증은 1440
 * 에서만 한다. 폰(390)에서는 "잘리지 않는가"만 본다.
 *
 * 좌표 기준값은 `docs/reference/figma/auth-spec.md` 실측값이다.
 */

const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }

/** 카드 · 첫 입력 · 첫 소셜 버튼 · 푸터 패널의 1440 기준 y. */
const LOGIN_LAYOUT = { cardY: 223, cardX: 290, cardW: 860, inputY: 451, socialY: 877, panelY: 1439 }
const SIGNUP_LAYOUT = {
  cardY: 223,
  cardX: 290,
  cardW: 860,
  inputY: 451,
  socialY: 1024,
  panelY: 1583,
}

/** 시안과 ±2px 안에서 같으면 통과로 본다(서브픽셀 반올림 여유). */
const TOLERANCE = 2

async function boxOf(page: import('@playwright/test').Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox()
  expect(box, `${selector} 를 찾지 못했다`).not.toBeNull()

  return box as { x: number; y: number; width: number; height: number }
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )

  expect(overflow).toBeLessThanOrEqual(0)
}

test.describe('로그인 화면', () => {
  test('should place the card, first field, social buttons and footer panel on the Figma grid at 1440', async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)

    // Act
    const response = await page.goto('/login')

    // Assert
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: '로그인', level: 1 })).toBeVisible()

    const card = await boxOf(page, 'main section')
    expect(Math.abs(card.x - LOGIN_LAYOUT.cardX)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(card.y - LOGIN_LAYOUT.cardY)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(card.width - LOGIN_LAYOUT.cardW)).toBeLessThanOrEqual(TOLERANCE)

    const email = await boxOf(page, '#login-email')
    expect(Math.abs(email.y - LOGIN_LAYOUT.inputY)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(email.height - 56)).toBeLessThanOrEqual(TOLERANCE)

    const social = await boxOf(page, 'main button[name="provider"]')
    expect(Math.abs(social.y - LOGIN_LAYOUT.socialY)).toBeLessThanOrEqual(TOLERANCE)

    const panel = await boxOf(page, 'footer .rounded-panel')
    expect(Math.abs(panel.y - LOGIN_LAYOUT.panelY)).toBeLessThanOrEqual(TOLERANCE)

    await expectNoHorizontalOverflow(page)
  })

  test('should keep the submit button locked until both fields are filled', async ({ page }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)
    await page.goto('/login')
    const submit = page.getByRole('button', { name: '로그인', exact: true })

    // Act & Assert — 시안의 비활성 상태(불투명도 25%).
    await expect(submit).toBeDisabled()

    await page.fill('#login-email', 'tester@glzaworld.co.kr')
    await expect(submit).toBeDisabled()

    await page.fill('#login-password', 'maple1234')
    await expect(submit).toBeEnabled()
  })

  test('should keep the animated GIFs as real gif images', async ({ page }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)
    await page.goto('/login')

    // Act
    const sources = await page.evaluate(() =>
      [...document.querySelectorAll('img')]
        .map((img) => img.currentSrc || img.src)
        .filter((src) => src.includes('.gif')),
    )

    // Assert — next/image 가 최적화하면 정지 이미지가 된다(`unoptimized` 필수).
    expect(sources.some((src) => src.includes('ufo.gif'))).toBe(true)
    expect(sources.some((src) => src.includes('mascot-footer.gif'))).toBe(true)
  })

  test('should show both header pills and link them to the two screens', async ({ page }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)
    await page.goto('/login')
    const header = page.locator('#site-desktop-auth')

    // Act & Assert
    await expect(header.getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/login')
    await expect(header.getByRole('link', { name: '회원가입' })).toHaveAttribute('href', '/signup')
  })
})

test.describe('회원가입 화면', () => {
  test('should place the two-column email row and the social buttons on the Figma grid at 1440', async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)

    // Act
    const response = await page.goto('/signup')

    // Assert
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: '회원가입', level: 1 })).toBeVisible()

    const card = await boxOf(page, 'main section')
    expect(Math.abs(card.x - SIGNUP_LAYOUT.cardX)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(card.y - SIGNUP_LAYOUT.cardY)).toBeLessThanOrEqual(TOLERANCE)

    const email = await boxOf(page, '#signup-email')
    expect(Math.abs(email.y - SIGNUP_LAYOUT.inputY)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(email.width - 435)).toBeLessThanOrEqual(TOLERANCE)

    const social = await boxOf(page, 'main button[name="provider"]')
    expect(Math.abs(social.y - SIGNUP_LAYOUT.socialY)).toBeLessThanOrEqual(TOLERANCE)

    const panel = await boxOf(page, 'footer .rounded-panel')
    expect(Math.abs(panel.y - SIGNUP_LAYOUT.panelY)).toBeLessThanOrEqual(TOLERANCE)

    await expectNoHorizontalOverflow(page)
  })

  test('should gate every step until the previous one is done', async ({ page }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)
    await page.goto('/signup')

    // Act & Assert — 주소가 형식에 맞기 전에는 전송 버튼이 잠겨 있다.
    await expect(page.getByRole('button', { name: '인증번호 전송' })).toBeDisabled()
    await page.fill('#signup-email', 'tester@glzaworld.co.kr')
    await expect(page.getByRole('button', { name: '인증번호 전송' })).toBeEnabled()

    // 인증번호를 보내기 전에는 "인증하기" 도, "가입하기" 도 잠겨 있다.
    await page.fill('#signup-code', '012345')
    await expect(page.getByRole('button', { name: '인증하기' })).toBeDisabled()

    await page.fill('#signup-password', 'maple1234')
    await page.fill('#signup-password-confirm', 'maple1234')
    await expect(page.getByRole('button', { name: '가입하기' })).toBeDisabled()
  })

  test('should explain a weak password only after something was typed', async ({ page }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)
    await page.goto('/signup')

    // Act & Assert
    await expect(page.getByText('영문과 숫자를 포함해')).toHaveCount(0)
    await page.fill('#signup-password', 'maple')
    await expect(page.getByText('영문과 숫자를 포함해')).toBeVisible()

    await page.fill('#signup-password', 'maple1234')
    await expect(page.getByText('영문과 숫자를 포함해')).toHaveCount(0)

    await page.fill('#signup-password-confirm', 'maple12345')
    await expect(page.getByText('비밀번호가 일치하지 않습니다.')).toBeVisible()
  })
})

test.describe('비밀번호 화면', () => {
  test('should render the forgot-password card', async ({ page }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)

    // Act
    const response = await page.goto('/forgot-password')

    // Assert — 프록시가 예전처럼 /login 으로 되돌리지 않는다.
    expect(response?.status()).toBe(200)
    expect(new URL(page.url()).pathname).toBe('/forgot-password')
    await expect(page.getByRole('heading', { name: '비밀번호 찾기', level: 1 })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('should send an unauthenticated visitor away from the reset screen', async ({ page }) => {
    // Arrange & Act
    await page.goto('/reset-password')

    // Assert — 메일 링크가 만든 세션이 있어야 열린다.
    const url = new URL(page.url())
    expect(url.pathname).toBe('/login')
    expect(url.searchParams.get('next')).toBe('/reset-password')
  })

  test('should keep /register as a permanent redirect to /signup', async ({ page }) => {
    // Arrange & Act
    await page.goto('/register?next=%2Fcommunity')

    // Assert
    const url = new URL(page.url())
    expect(url.pathname).toBe('/signup')
    expect(url.searchParams.get('next')).toBe('/community')
  })
})

test.describe('폰 폭(390)', () => {
  test.use({ viewport: PHONE })

  for (const path of ['/login', '/signup', '/forgot-password']) {
    test(`should fit ${path} without horizontal overflow`, async ({ page }) => {
      // Arrange & Act
      await page.goto(path)

      // Assert
      await expectNoHorizontalOverflow(page)

      const card = await boxOf(page, 'main section')
      expect(card.x).toBeGreaterThanOrEqual(0)
      expect(card.x + card.width).toBeLessThanOrEqual(PHONE.width)

      // 마스코트·UFO 도 화면 안에 있어야 한다(오너 요구: 어떤 폭에서도 잘리지 않는다).
      const ufo = await boxOf(page, 'main img[src*="ufo"]')
      expect(ufo.x).toBeGreaterThanOrEqual(0)
      expect(ufo.x + ufo.width).toBeLessThanOrEqual(PHONE.width)
    })
  }
})
