import { expect, test } from '@playwright/test'

/**
 * `site_settings` 연동 확인.
 *
 * DB 를 읽는 값이라 정확한 문자열을 단정하면 운영자가 설정을 바꾸는 순간
 * 테스트가 깨진다. "그 자리에 값이 있고, 형태가 옳다"까지만 본다
 * (문자열 자체의 폴백 규칙은 `tests/unit/data/site-view.test.ts` 가 맡는다).
 */

test.describe('푸터 — 연락처 · 저작권', () => {
  test('should show a contact mail link whose href is punycode', async ({ page }) => {
    await page.goto('/')

    const mailLink = page.locator('footer a[href^="mailto:"]').first()

    await expect(mailLink).toBeVisible()

    const href = await mailLink.getAttribute('href')
    const label = (await mailLink.innerText()).trim()

    // href 는 ASCII 도메인이어야 메일 클라이언트가 연다.
    expect(href).toMatch(/^mailto:[^@\s]+@[\x20-\x7e]+$/u)
    expect(href).not.toMatch(/[^\x00-\x7f]/u)
    // 화면 표기는 한글 도메인 그대로다(시안).
    expect(label).toContain('@')
    expect(label).toMatch(/[가-힣]/u)
  })

  test('should show a copyright line in the footer', async ({ page }) => {
    await page.goto('/')

    await expect(
      page
        .locator('footer')
        .getByText(/All rights reserved/i)
        .first(),
    ).toBeVisible()
  })
})

test.describe('소개 페이지', () => {
  // 오너 요청: 소개 메뉴는 기본 비활성화(`FEATURES.aboutDisabled`, 기본 ON)라
  // `/about` 이 `/` 로 리다이렉트된다(`tests/e2e/smoke.spec.ts` 가 그 리다이렉트를
  // 검증한다). 크리에이터 패널의 DB 연동 자체는 여전히 유효한 회귀 검증이므로
  // 지우지 않고 skip 으로 남긴다 — 오너가 `NEXT_PUBLIC_FEATURE_ABOUT_DISABLED=false`
  // 로 다시 열면 이 skip 을 지운다.
  test.skip('should render the creator panel from settings', async ({ page }) => {
    await page.goto('/about')

    // sr-only h1 은 크리에이터 이름으로 만들어진다.
    await expect(page.getByRole('heading', { level: 1 })).toContainText('소개')

    const paragraphs = page.locator('p.font-intro')

    await expect(paragraphs.first()).toBeVisible()
    expect(await paragraphs.count()).toBeGreaterThanOrEqual(1)
  })
})

test.describe('개인정보처리방침', () => {
  test('should show the IP notice section', async ({ page }) => {
    await page.goto('/policy/privacy')

    const notice = page.locator('#ip-notice')

    await expect(notice).toHaveText('지식재산권 고지')
    await expect(notice.locator('xpath=following-sibling::p').first()).toContainText('MapleStory')
  })
})

test.describe('POST /api/revalidate', () => {
  const endpoint = '/api/revalidate'

  test('should reject a request without the shared secret', async ({ request }) => {
    const response = await request.post(endpoint, { data: { tags: ['site'] } })

    expect(response.status()).toBe(401)
  })

  test('should reject a wrong secret', async ({ request }) => {
    const response = await request.post(endpoint, {
      headers: { 'x-revalidate-secret': 'definitely-not-the-secret' },
      data: { tags: ['site'] },
    })

    expect(response.status()).toBe(401)
  })

  test('should revalidate known tags with the right secret', async ({ request }) => {
    const secret = process.env.REVALIDATE_SECRET

    // 시크릿 없이 도는 CI 에서는 401 경로만 검증하고 넘어간다.
    test.skip(secret === undefined || secret === '', 'REVALIDATE_SECRET 미설정')

    const ok = await request.post(endpoint, {
      headers: { 'x-revalidate-secret': secret as string },
      data: { tags: ['site'] },
    })

    expect(ok.status()).toBe(200)
    expect(await ok.json()).toEqual({ revalidated: ['site'] })

    const bad = await request.post(endpoint, {
      headers: { 'x-revalidate-secret': secret as string },
      data: { tags: ['definitely-unknown-tag'] },
    })

    expect(bad.status()).toBe(400)
  })
})
