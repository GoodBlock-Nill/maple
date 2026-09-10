import { expect, test } from '@playwright/test'

test('should respond with 200 and show header when visiting home page', async ({ page }) => {
  const response = await page.goto('/')

  expect(response?.status()).toBe(200)
  await expect(page.locator('header')).toBeVisible()
})

// 오너 요청: 소개 메뉴 자체를 안 보이게(기본 ON). 다시 열리면
// (NEXT_PUBLIC_FEATURE_ABOUT_DISABLED=false) 이 테스트는 실패해야 정상이다 —
// 그때는 아래 두 케이스를 지운다.
test('should hide 소개 from the header, drawer, and footer menu entirely', async ({ page }) => {
  await page.goto('/')

  // 자리표시(회색 비활성)가 아니라 항목 자체가 없어야 한다 — 텍스트도 링크도.
  await expect(page.getByText('소개', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '소개' })).toHaveCount(0)
})

test('should redirect /about (and sub-paths) to the home page while disabled', async ({ page }) => {
  const response = await page.goto('/about/anything')

  expect(response?.status()).toBe(200)
  await expect(page).toHaveURL('/')
})
