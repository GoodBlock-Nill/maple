import { chromium, devices, expect, test, webkit } from '@playwright/test'

import type { Browser, BrowserContext, Locator, Page } from '@playwright/test'

/**
 * 실기기 터치 회귀 테스트.
 *
 * 왜 별도 스펙인가: 실제 아이폰/갤럭시에서만 재현된 두 부류의 버그가 있었다.
 *
 * 1. 헤더 `.glass` 의 `backdrop-filter` 가 `position: fixed` 자손의 containing
 *    block 이 되면서, 헤더 안에 있던 모바일 드로어가 헤더 높이(74px)로 잘렸다.
 *    **WebKit 에서만** 재현된다(Blink 는 backdrop-filter 로 containing block 을
 *    만들지 않는다). 그래서 Chromium 기기 에뮬레이션만으로는 절대 못 잡는다 —
 *    이 스펙이 WebKit 을 직접 띄우는 이유다.
 * 2. `touch-action` 기본값(`auto`)이 남긴 더블탭 확대 대기(최대 300ms).
 *
 * playwright.config.ts 의 projects 를 건드리면 다른 스펙의 병렬 실행 축이
 * 바뀌므로(프로젝트 이름으로 픽스처를 나눠 쓰는 스펙이 있다), 여기서는 엔진을
 * 직접 띄우고 chromium 프로젝트에서 한 번만 돈다.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

type Engine = {
  name: string
  launch: () => Promise<Browser>
  device: (typeof devices)[string]
}

const ENGINES: readonly Engine[] = [
  { name: 'webkit · iPhone 14', launch: () => webkit.launch(), device: devices['iPhone 14'] },
  { name: 'chromium · Galaxy S9+', launch: () => chromium.launch(), device: devices['Galaxy S9+'] },
]

/**
 * 좌표 히트 테스트 — "보인다"가 아니라 "그 좌표를 누르면 이 요소가 잡힌다"를 본다.
 * 가시성 검사만으로는 투명 오버레이(히어로 GIF 레이어, sticky 헤더 래퍼)가
 * 버튼 위를 덮고 있는 상황을 놓친다.
 */
async function isHittable(locator: Locator): Promise<boolean> {
  return locator.evaluate((el) => {
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return false
    const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
    return top !== null && (el.contains(top) || top.contains(el))
  })
}

/**
 * 홈으로 이동하고 하이드레이션이 끝날 때까지 기다린다.
 *
 * `domcontentloaded` 직후에 햄버거를 누르면 아직 React 핸들러가 붙지 않아
 * 아무 일도 일어나지 않는다. 이 경합 자체가 실기기에서 "메뉴 버튼이 안 눌린다"
 * 로 보고된 증상의 한 갈래였고(폰트 2.8MB 가 먼저 내려오던 시절), 스크립트가
 * 늦을수록 창이 길어진다. 여기서는 그 경합을 테스트 대상에서 분리한다.
 */
async function gotoHome(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'load' })
  await page.waitForLoadState('networkidle')
}

/** 햄버거를 눌러 드로어를 연다. 열린 것까지 확인하고 패널을 돌려준다. */
async function openDrawer(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: '메뉴 열기' }).tap()
  const panel = page.locator('#mobile-nav-panel')
  await expect(panel).toBeVisible()
  return panel
}

for (const engine of ENGINES) {
  test.describe(`모바일 터치 (${engine.name})`, () => {
    let browser: Browser | null = null
    let context: BrowserContext
    let page: Page

    test.beforeEach(async ({}, testInfo) => {
      // 엔진을 이 스펙이 직접 띄우므로 설정된 프로젝트 수만큼 반복할 이유가 없다.
      test.skip(testInfo.project.name !== 'chromium', '엔진을 직접 띄우는 스펙')

      browser = await engine.launch()
      context = await browser.newContext({ ...engine.device, hasTouch: true })
      page = await context.newPage()
    })

    test.afterEach(async () => {
      await context?.close()
      await browser?.close()
      browser = null
    })

    test('드로어를 열면 패널이 뷰포트 전체 높이를 차지한다', async () => {
      await gotoHome(page)
      const panel = await openDrawer(page)

      const viewport = page.viewportSize()
      const box = await panel.boundingBox()

      expect(box).not.toBeNull()
      expect(viewport).not.toBeNull()
      // 헤더(74px)에 갇히면 여기서 걸린다 — 회귀의 핵심 지표다.
      expect(box!.height).toBeGreaterThanOrEqual(viewport!.height - 2)
      expect(box!.y).toBeLessThanOrEqual(1)
    })

    test('드로어 → 메뉴 항목 탭 → 이동 → 드로어가 닫힌다', async () => {
      await gotoHome(page)
      const panel = await openDrawer(page)
      const newsLink = panel.getByRole('link', { name: '뉴스', exact: true })

      // 실제 좌표로 탭이 떨어지는지까지 본다(합성 클릭이 아니라 터치 시퀀스).
      const box = await newsLink.boundingBox()
      expect(box).not.toBeNull()
      await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2)

      await page.waitForURL('**/news', { timeout: 15000 })
      await expect(panel).toBeHidden()
    })

    test('드로어 딤을 탭하면 닫힌다', async () => {
      await gotoHome(page)
      const panel = await openDrawer(page)

      // 패널은 오른쪽 86% 를 덮으므로 왼쪽 끝은 딤이다.
      await page.touchscreen.tap(12, 300)
      await expect(panel).toBeHidden()
    })

    test('히어로 CTA 가 화면 안에 있고 다른 레이어에 가려지지 않는다', async () => {
      await gotoHome(page)

      const cta = page.locator('#main-content a[href="/play"]').first()
      await expect(cta).toBeVisible()

      const viewport = page.viewportSize()
      const box = await cta.boundingBox()
      expect(box).not.toBeNull()
      // 화면 밖으로 밀려나면 아무리 눌러도 닿지 않는다(좁은 폭에서의 가로 넘침).
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width)

      // 히어로 GIF 레이어(HeroCharacterLayer)가 CTA 위를 덮지 않아야 한다.
      expect(await isHittable(cta)).toBe(true)

      // `/play` 는 외부 사이트로 302 하므로 요청만 확인하고 실제 이동은 막는다.
      // "탭이 링크를 실제로 활성화했는가"가 확인하려는 전부다.
      await page.route('**/play', (route) => route.abort())
      const navigation = page.waitForRequest(
        (request) => request.isNavigationRequest() && request.url().endsWith('/play'),
        { timeout: 15000 },
      )
      await cta.tap()
      expect((await navigation).url()).toContain('/play')
    })

    test('푸터 문의 링크를 탭할 수 있다', async () => {
      await gotoHome(page)

      const contact = page.locator('footer a[href^="mailto:"]').first()
      await contact.scrollIntoViewIfNeeded()
      await expect(contact).toBeVisible()
      expect(await isHittable(contact)).toBe(true)
    })

    test('주요 컨트롤에 touch-action: manipulation 이 걸려 있다', async () => {
      await gotoHome(page)

      const values = await page.evaluate(() =>
        ['header button', '#main-content a', 'footer a'].map((sel) => {
          const el = document.querySelector(sel)
          return el === null ? 'missing' : getComputedStyle(el).touchAction
        }),
      )

      // 기본값 `auto` 면 iOS 가 더블탭 확대를 기다리느라 첫 탭이 최대 300ms 늦는다.
      expect(values).toEqual(['manipulation', 'manipulation', 'manipulation'])
    })
  })
}
