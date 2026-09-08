import { expect, test } from '@playwright/test'

test('should respond with 200 and show header when visiting home page', async ({ page }) => {
  const response = await page.goto('/')

  expect(response?.status()).toBe(200)
  await expect(page.locator('header')).toBeVisible()
})
