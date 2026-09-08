import { expect, test } from '@playwright/test'

import type { Locator, Page } from '@playwright/test'

/**
 * 뉴스 말머리 6종 + 카테고리 배너 회귀 테스트.
 *
 * 브라우저 경로는 `PLAYWRIGHT_CHROMIUM_PATH` 로만 덮어쓴다(로컬 캐시 경로를
 * 저장소에 박아 두면 다른 머신에서 깨진다).
 */
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH

test.use(CHROMIUM_PATH === undefined ? {} : { launchOptions: { executablePath: CHROMIUM_PATH } })

/** 스크린샷 저장 위치. 지정하지 않으면 Playwright 기본 산출물 폴더에 남긴다. */
const SHOT_DIR = process.env.VERIFY_SCREENSHOT_DIR ?? 'test-results/verify'

const CHIP_NAV = 'nav[aria-label="뉴스 카테고리"]'
const NEWS_ROW = 'a[href^="/news/"]'

const EXPECTED_CHIPS = [
  '전체',
  '공지사항',
  '점검안내',
  '업데이트 안내',
  '패치노트',
  '이벤트',
  '안내사항',
]

/** 문서 전체가 가로로 넘치지 않는지. 1px 은 반올림 오차 허용치다. */
async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const root = document.documentElement

    return root.scrollWidth - root.clientWidth
  })
}

async function elementOverflow(locator: Locator): Promise<number> {
  return locator.evaluate((element) => element.scrollWidth - element.clientWidth)
}

/**
 * `next/image` 는 `/_next/image?url=...` 로 감싼 주소를 렌더한다.
 * 원본 경로를 비교해야 하므로 `url` 파라미터를 풀어 준다.
 */
async function imageSource(image: Locator): Promise<string> {
  const src = (await image.getAttribute('src')) ?? ''

  if (!src.startsWith('/_next/image')) {
    return src
  }

  const params = new URLSearchParams(src.slice(src.indexOf('?') + 1))

  return params.get('url') ?? src
}

/** dev 서버는 배너를 즉석에서 최적화한다. 그림이 도착한 뒤에 찍어야 한다. */
async function waitForLoadedImage(image: Locator): Promise<void> {
  await expect
    .poll(async () =>
      image.evaluate((element) => {
        const img = element as HTMLImageElement

        return img.complete && img.naturalWidth > 0
      }),
    )
    .toBe(true)
}

type Rect = { x: number; y: number; height: number }

/**
 * 뱃지 · 제목 · 메타 줄의 위치. 공유 버튼이 배치를 밀지 않았는지 비교용.
 *
 * 클릭으로 스크롤이 움직여도 값이 흔들리지 않게 문서 기준 좌표로 환산한다.
 * 폭은 빼고 본다 — 조회수가 렌더 중에 1 늘어나면서 글자 폭이 미세하게 달라진다.
 */
async function headerRects(page: Page): Promise<readonly (Rect | null)[]> {
  return page.evaluate(() => {
    const selectors = ['article header span.rounded-pill', 'article header h2', 'article header p']

    return selectors.map((selector) => {
      const element = document.querySelector(selector)

      if (element === null) {
        return null
      }

      const rect = element.getBoundingClientRect()

      return {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        height: rect.height,
      }
    })
  })
}

test.describe('news categories', () => {
  test('should show seven chips without horizontal overflow when viewed at 1440', async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize({ width: 1440, height: 1000 })

    // Act
    await page.goto('/news')
    const chips = page.locator(`${CHIP_NAV} li`)

    // Assert
    await expect(chips).toHaveCount(7)
    await expect(chips).toHaveText(EXPECTED_CHIPS)
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
    expect(await elementOverflow(page.locator(CHIP_NAV))).toBeLessThanOrEqual(1)

    await page.screenshot({ path: `${SHOT_DIR}/news-categories-1440.png` })
  })

  test('should wrap chips instead of scrolling sideways when viewed at 390', async ({ page }) => {
    // Arrange
    await page.setViewportSize({ width: 390, height: 844 })

    // Act
    await page.goto('/news')
    const chips = page.locator(`${CHIP_NAV} li`)

    // Assert
    await expect(chips).toHaveCount(7)
    await expect(chips).toHaveText(EXPECTED_CHIPS)
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
    expect(await elementOverflow(page.locator(CHIP_NAV))).toBeLessThanOrEqual(1)

    // 줄바꿈이 실제로 일어났는지 — 첫 칩과 마지막 칩의 y 가 달라야 한다.
    const first = await chips.first().boundingBox()
    const last = await chips.last().boundingBox()
    expect(first?.y ?? 0).toBeLessThan(last?.y ?? 0)

    await page.screenshot({ path: `${SHOT_DIR}/news-categories-390.png` })
  })

  test('should filter rows to 점검안내 only when the chip is clicked', async ({ page }) => {
    // Arrange
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/news')

    // Act
    await page.locator(CHIP_NAV).getByRole('link', { name: '점검안내', exact: true }).click()
    await page.waitForURL('**/news?category=maintenance')

    // Assert
    const rows = page.locator(NEWS_ROW)
    await expect(rows.first()).toBeVisible()
    const badges = await rows.locator('span.rounded-pill').allInnerTexts()
    expect(badges.length).toBeGreaterThan(0)
    expect(new Set(badges)).toEqual(new Set(['점검안내']))
  })
})

test.describe('news detail banner', () => {
  test('should render the category banner and expose it as the og image', async ({ page }) => {
    // Arrange
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/news?category=maintenance')

    // Act
    await page.locator(NEWS_ROW).first().click()
    await page.waitForURL(/\/news\/[0-9a-f-]+$/)
    const banner = page.getByRole('img', { name: '점검안내 배너' })

    // Assert
    await expect(banner).toBeVisible()
    await waitForLoadedImage(banner)
    expect(await imageSource(banner)).toBe('/images/news/banners/maintenance.png')

    const box = await banner.boundingBox()
    expect((box?.width ?? 0) / (box?.height ?? 1)).toBeCloseTo(1200 / 628, 1)

    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content')
    const twitterImage = await page.locator('meta[name="twitter:image"]').getAttribute('content')
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
    expect(ogImage).toMatch(/^https?:\/\/.+\/images\/news\/banners\/maintenance\.png$/)
    expect(twitterImage).toBe(ogImage)
    expect(canonical).toBe(page.url())
  })

  test('should copy the canonical url and show the toast when 공유 is clicked', async ({
    page,
    context,
  }) => {
    // Arrange
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/news?category=maintenance')
    await page.locator(NEWS_ROW).first().click()
    await page.waitForURL(/\/news\/[0-9a-f-]+$/)

    await waitForLoadedImage(page.getByRole('img', { name: '점검안내 배너' }))

    // 공유 버튼은 흐름에서 빠져 있어야 한다(absolute). 지우기 전후 배치가 같아야 통과.
    const before = await headerRects(page)

    // Act
    await page.getByRole('button', { name: '링크 공유' }).click()

    // Assert
    await expect(page.getByRole('status')).toHaveText('링크가 복사되었습니다')
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toBe(page.url())

    await page.screenshot({ path: `${SHOT_DIR}/news-detail-banner-1440.png`, fullPage: true })

    await page.evaluate(() => {
      document.querySelector('[aria-label="링크 공유"]')?.closest('div.absolute')?.remove()
    })
    expect(await headerRects(page)).toEqual(before)
  })
})

test.describe('community regression', () => {
  test('should keep the community row height at 81px when news changes ship', async ({ page }) => {
    // Arrange
    await page.setViewportSize({ width: 1440, height: 1000 })

    // Act
    await page.goto('/community')
    // 목록 시트(.bg-tray) 안의 행만 센다 — "글쓰기"(/community/write)도 같은 접두사다.
    const firstRow = page.locator('.bg-tray a[href^="/community/"]').first()

    // Assert — 뉴스와 공유하는 BOARD_ROW_* 클래스가 흔들리지 않았다는 증거다.
    await expect(firstRow).toBeVisible()
    const box = await firstRow.boundingBox()
    expect(Math.round(box?.height ?? 0)).toBe(81)
  })
})
