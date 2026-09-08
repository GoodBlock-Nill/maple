import { expect, test } from '@playwright/test'

/**
 * 비로그인 사용자가 보는 커뮤니티 액션(신고 · 수정 진입 차단)과 신고 다이얼로그의
 * 접근성 계약을 확인한다. 테스트 계정이 없어 로그인 이후 흐름은 단위 테스트
 * (`tests/unit/actions/*`)와 `tests/manual/reports-rls-check.mjs` 가 담당한다.
 */

const POST_ID = '22222222-0000-4000-8000-000000000003'
const DETAIL_PATH = `/community/${POST_ID}`

test('should offer a report action that routes anonymous visitors to login', async ({ page }) => {
  // Arrange
  await page.goto(DETAIL_PATH)

  // Act
  const reportLinks = page.getByRole('link', { name: '신고' })

  // Assert — 본문 1개 + 댓글 수만큼
  await expect(reportLinks.first()).toBeVisible()
  expect(await reportLinks.count()).toBeGreaterThan(1)

  await reportLinks.first().click()
  await expect(page).toHaveURL(`/login?next=${encodeURIComponent(DETAIL_PATH)}`)
})

test('should not show author only actions to anonymous visitors', async ({ page }) => {
  // Arrange & Act
  await page.goto(DETAIL_PATH)

  // Assert
  await expect(page.getByRole('link', { name: '수정' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '삭제' })).toHaveCount(0)
})

test('should redirect anonymous visitors away from the edit page', async ({ page }) => {
  // Arrange & Act
  await page.goto(`${DETAIL_PATH}/edit`)

  // Assert
  await expect(page).toHaveURL(`/login?next=${encodeURIComponent(`${DETAIL_PATH}/edit`)}`)
})

test('should expose the report dialog as a labelled modal that Escape closes', async ({ page }) => {
  // Arrange — 신고 버튼은 로그인 사용자 전용이라 개발 전용 하네스로 연다.
  await page.goto('/community/dialog-preview')

  const dialog = page.getByRole('dialog')

  // Assert — 접근성 계약
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  await expect(dialog).toHaveAccessibleName('게시글 신고')
  await expect(page.getByRole('radio', { name: '스팸·광고' })).toBeAttached()
  await expect(page.getByRole('radio', { name: '개인정보 노출' })).toBeAttached()
  await expect(page.getByRole('textbox', { name: /상세 내용/ })).toBeVisible()

  // Act — Escape 로 닫힌다
  await page.keyboard.press('Escape')

  // Assert
  await expect(dialog).toHaveCount(0)
})

test('should return focus to the trigger after the report dialog closes', async ({ page }) => {
  // Arrange — 하네스는 열린 채로 시작하므로 한 번 닫고, 트리거로 다시 연다.
  await page.goto('/community/dialog-preview')
  await page.keyboard.press('Escape')

  const trigger = page.getByRole('button', { name: '신고' })

  // Act
  await trigger.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')

  // Assert
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(trigger).toBeFocused()
})
