import { expect, test } from '@playwright/test'

/**
 * 로그인 화면(시안 auth-v2, Figma 2UmKcpmy55IqMZ7Sg6vTeW).
 *
 * 로그인 수단이 간편로그인(구글·네이버)뿐이라 화면도 하나다 — 이메일 가입·비밀번호
 * 찾기·재설정 경로는 모두 `/login` 으로 돌려보낸다.
 *
 * 좌표 기준값은 `docs/reference/figma/auth-v2-spec.md` 실측값이다. PC 는 1440,
 * 폰은 375 프레임이며 여기서는 실기기 폭 390 으로 본다(가운데 정렬이라 x 만 다르다).
 */

const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }

/** 시안과 ±2px 안에서 같으면 통과로 본다(서브픽셀 반올림 여유). */
const TOLERANCE = 2

/** 1440 기준 실측값. */
const PC = {
  titleY: 300,
  subtitleY: 352,
  buttonX: 520,
  buttonW: 400,
  buttonH: 54,
  googleY: 422,
  naverY: 496,
  errorY: 578,
  errorIcon: 24,
  footerY: 868,
  pageHeight: 1456,
  leftCharacter: { x: 325, y: 229, width: 175, height: 180 },
  rightCharacter: { x: 940, y: 475, width: 205, height: 187 },
}

/** 390 기준(시안 375 + 좌우 여백 16 → 폭 343). */
const MOBILE = { titleY: 196, buttonW: 343, buttonH: 48, googleY: 306, naverY: 370, errorY: 442 }

type Box = { x: number; y: number; width: number; height: number }

async function boxOf(page: import('@playwright/test').Page, selector: string): Promise<Box> {
  const box = await page.locator(selector).first().boundingBox()
  expect(box, `${selector} 를 찾지 못했다`).not.toBeNull()

  return box as Box
}

function expectNear(actual: number, expected: number, label: string) {
  expect(Math.abs(actual - expected), `${label}: ${actual} ≠ ${expected}`).toBeLessThanOrEqual(
    TOLERANCE,
  )
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )

  expect(overflow).toBeLessThanOrEqual(0)
}

test.describe('로그인 화면 (1440)', () => {
  test('should place the title, both buttons and the footer on the Figma grid', async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)

    // Act
    const response = await page.goto('/login')

    // Assert
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: '로그인', level: 1 })).toBeVisible()

    const title = await boxOf(page, 'main h1')
    expectNear(title.y, PC.titleY, '제목 y')

    const subtitle = await boxOf(page, 'main h1 + p')
    expectNear(subtitle.y, PC.subtitleY, '부제 y')

    const google = await boxOf(page, 'main button[value="google"]')
    expectNear(google.x, PC.buttonX, '구글 버튼 x')
    expectNear(google.y, PC.googleY, '구글 버튼 y')
    expectNear(google.width, PC.buttonW, '구글 버튼 폭')
    expectNear(google.height, PC.buttonH, '구글 버튼 높이')

    const naver = await boxOf(page, 'main button[value="naver"]')
    expectNear(naver.x, PC.buttonX, '네이버 버튼 x')
    expectNear(naver.y, PC.naverY, '네이버 버튼 y')
    expectNear(naver.height, PC.buttonH, '네이버 버튼 높이')

    const footer = await boxOf(page, 'footer')
    expectNear(footer.y, PC.footerY, '푸터 상단 y')

    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight)
    expectNear(pageHeight, PC.pageHeight, '페이지 높이')

    await expectNoHorizontalOverflow(page)
  })

  test('should stand the two characters beside the content column', async ({ page }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)

    // Act
    await page.goto('/login')

    // Assert — 시안 Group 225 · 226 실측값.
    const left = await boxOf(page, 'main img[src*="char-left"]')
    expectNear(left.x, PC.leftCharacter.x, '왼쪽 캐릭터 x')
    expectNear(left.y, PC.leftCharacter.y, '왼쪽 캐릭터 y')
    expectNear(left.width, PC.leftCharacter.width, '왼쪽 캐릭터 폭')
    expectNear(left.height, PC.leftCharacter.height, '왼쪽 캐릭터 높이')

    const right = await boxOf(page, 'main img[src*="char-right"]')
    expectNear(right.x, PC.rightCharacter.x, '오른쪽 캐릭터 x')
    expectNear(right.y, PC.rightCharacter.y, '오른쪽 캐릭터 y')
    expectNear(right.width, PC.rightCharacter.width, '오른쪽 캐릭터 폭')

    // 말풍선 두 개가 캐릭터 위에 붙어 있다.
    await expect(page.locator('main [data-bubble]')).toHaveCount(2)
    await expect(page.getByText('글자월드에요!')).toBeVisible()
  })

  test('should keep the error row out of the page until something failed', async ({ page }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)

    // Act
    await page.goto('/login')

    // Assert — 개발 서버의 Next 오버레이도 role=alert 를 쓰므로 본문으로 좁힌다.
    await expect(page.locator('main [role="alert"]')).toHaveCount(0)
  })

  test('should show the design error row for ?error=oauth_failed', async ({ page }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)

    // Act
    await page.goto('/login?error=oauth_failed')

    // Assert
    const alert = page.locator('main [role="alert"]')
    await expect(alert).toHaveText('로그인에 실패했어요. 잠시 후 다시 시도해주세요')

    const row = await boxOf(page, 'main [role="alert"]')
    expectNear(row.y, PC.errorY, '오류 행 y')

    const icon = await boxOf(page, 'main [role="alert"] svg')
    expectNear(icon.height, PC.errorIcon, '오류 아이콘 크기')

    await expectNoHorizontalOverflow(page)
  })

  test('should offer social sign-in only', async ({ page }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)

    // Act
    await page.goto('/login')

    // Assert — 이메일·비밀번호 입력칸과 카카오 버튼은 시안에 없다.
    await expect(page.locator('main button[value="google"]')).toBeVisible()
    await expect(page.locator('main button[value="naver"]')).toBeVisible()
    await expect(page.locator('main input[type="password"]')).toHaveCount(0)
    await expect(page.locator('main button[value="kakao"]')).toHaveCount(0)
  })

  test('should keep the footer mascot an animated gif', async ({ page }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)

    // Act
    await page.goto('/login')
    const sources = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLImageElement>('footer img')].map(
        (img) => img.currentSrc || img.src,
      ),
    )

    // Assert — next/image 가 최적화하면 정지 이미지가 된다(`unoptimized` 필수).
    expect(sources.some((src) => src.endsWith('home-mascot.gif'))).toBe(true)
  })

  test('should show a single login pill in the header', async ({ page }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)

    // Act
    await page.goto('/login')
    const header = page.locator('#site-desktop-auth')

    // Assert
    await expect(header.getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/login')
    await expect(header.getByRole('link')).toHaveCount(1)
  })
})

test.describe('사라진 경로', () => {
  for (const path of ['/signup', '/forgot-password', '/reset-password']) {
    test(`should send ${path} to /login`, async ({ page }) => {
      // Arrange & Act
      await page.goto(path)

      // Assert
      expect(new URL(page.url()).pathname).toBe('/login')
    })
  }

  test('should keep /register as a permanent redirect to /login', async ({ page }) => {
    // Arrange & Act
    await page.goto('/register?next=%2Fcommunity')

    // Assert
    const url = new URL(page.url())
    expect(url.pathname).toBe('/login')
    expect(url.searchParams.get('next')).toBe('/community')
  })
})

test.describe('폰 폭(390)', () => {
  test.use({ viewport: PHONE })

  test('should stack the two buttons full width without characters', async ({ page }) => {
    // Arrange & Act
    await page.goto('/login')

    // Assert
    const title = await boxOf(page, 'main h1')
    expectNear(title.y, MOBILE.titleY, '제목 y')

    const google = await boxOf(page, 'main button[value="google"]')
    expectNear(google.y, MOBILE.googleY, '구글 버튼 y')
    expectNear(google.width, MOBILE.buttonW, '구글 버튼 폭')
    expectNear(google.height, MOBILE.buttonH, '구글 버튼 높이')
    expect(google.x).toBeGreaterThanOrEqual(0)
    expect(google.x + google.width).toBeLessThanOrEqual(PHONE.width)

    const naver = await boxOf(page, 'main button[value="naver"]')
    expectNear(naver.y, MOBILE.naverY, '네이버 버튼 y')

    // 시안 모바일에는 캐릭터가 없다.
    await expect(page.locator('main img[src*="char-left"]')).toBeHidden()

    await expectNoHorizontalOverflow(page)
  })

  test('should put the error row under the buttons', async ({ page }) => {
    // Arrange & Act
    await page.goto('/login?error=oauth_failed')

    // Assert
    const row = await boxOf(page, 'main [role="alert"]')
    expectNear(row.y, MOBILE.errorY, '오류 행 y')
    expect(row.x).toBeGreaterThanOrEqual(0)
    expect(row.x + row.width).toBeLessThanOrEqual(PHONE.width)

    await expectNoHorizontalOverflow(page)
  })
})
