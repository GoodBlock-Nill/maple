import { execFileSync } from 'node:child_process'

import { expect, test } from '@playwright/test'

import type { Page } from '@playwright/test'

/**
 * 내 문의 내역.
 *
 * 접수(스텁 로그인 → 폼 제출) → 상세의 접수 안내 → 목록 노출 → 운영자 답변 표시까지
 * 한 흐름으로 확인하고, 소유자가 아닌 접근(비로그인 · 다른 계정)이 각각 로그인
 * 유도와 404 로 끝나는지 본다.
 *
 * 답변은 관리자 화면이 아직 없어 서비스 롤 스크립트로 넣는다
 * (`tests/manual/inquiry-reply-insert.mjs`).
 */

const SUPPORT_PATH = '/support'
const LIST_PATH = '/support/inquiries'
const SCREENSHOT_DIR =
  '/private/tmp/claude-501/-Users-goodblock-Projects-maple/61a98c42-b684-4d24-8c7f-385f43df2325/scratchpad/verify'

const REPLY_CONTENT = '문의 주신 내용 확인했습니다. 순차적으로 처리해 드리겠습니다.'

/** 실행마다 새 계정이 생기므로 유니크 제약에 걸리지 않게 매번 다른 값을 만든다. */
function randomDigits(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('')
}

/** 폼에 있을 때만 채운다. 온보딩 항목은 늘어날 수 있다. */
async function fillIfPresent(page: Page, name: string, value: string): Promise<void> {
  const field = page.locator(`input[name="${name}"]`)

  if ((await field.count()) > 0) {
    await field.fill(value)
  }
}

/**
 * 스텁 간편로그인 + 온보딩.
 *
 * 익명 로그인이 켜져 있으면 실행할 때마다 새 계정이 생겨 온보딩을 거치고,
 * 데모 계정 폴백이면 이미 온보딩을 마친 상태로 곧장 목적지에 도착한다.
 */
async function stubLogin(page: Page, nextPath: string): Promise<void> {
  await page.goto(`/login?next=${encodeURIComponent(nextPath)}`)
  await page.getByRole('button', { name: '카카오로 계속하기' }).click()
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

async function submitInquiry(page: Page, title: string): Promise<string> {
  await page.locator('input[name="accountId"]').fill(randomDigits(15))
  await page.locator('select[name="category"]').selectOption('계정')
  await page.locator('select[name="type"]').selectOption('문의')
  await page.locator('input[name="title"]').fill(title)
  await page.locator('textarea[name="content"]').fill('E2E 로 접수한 문의입니다.\n두 번째 줄.')
  await page.locator('input[name="consent"]').check()
  await page.getByRole('button', { name: '문의 등록하기' }).click()

  await page.waitForURL(/\/support\/inquiries\/[0-9a-f-]{36}/)

  return page.url().split('/').pop()?.split('?')[0] ?? ''
}

test('should send anonymous visitors to login when they open 내 문의 내역', async ({ page }) => {
  // Arrange & Act
  await page.goto(LIST_PATH)

  // Assert
  await expect(page).toHaveURL(`/login?next=${encodeURIComponent(LIST_PATH)}`)
})

test('should show the support menu entry to anonymous visitors as well', async ({ page }) => {
  // Arrange & Act — 메뉴는 항상 보이고, 눌렀을 때 로그인으로 안내한다.
  await page.goto(SUPPORT_PATH)

  const menuLink = page.getByRole('link', { name: '내 문의 내역' })

  // Assert
  await expect(menuLink).toBeVisible()

  await menuLink.click()
  await expect(page).toHaveURL(`/login?next=${encodeURIComponent(LIST_PATH)}`)
})

test('should accept an inquiry, list it, and surface the operator reply', async ({
  browser,
  page,
}, testInfo) => {
  // Arrange
  const isDesktop = testInfo.project.name === 'chromium'

  if (isDesktop) {
    await page.setViewportSize({ width: 1440, height: 1200 })
  }

  await stubLogin(page, SUPPORT_PATH)

  const title = `E2E 문의 ${Date.now()}`

  // Act — 접수
  const inquiryId = await submitInquiry(page, title)

  /* 모바일 헤더가 오프스크린 내비게이션을 role="dialog" 로 들고 있어서, 이름 없이
     dialog 를 찾으면 두 개가 잡힌다(strict mode 위반). 이름으로 좁힌다. */
  const dialog = page.getByRole('dialog', { name: '문의가 접수되었습니다' })

  // Assert — 접수 완료 모달이 뜬다
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('운영자가 확인 후 답변을 등록하면')
  await expect(dialog.getByRole('link', { name: '내 문의 내역 보기' })).toBeVisible()

  if (isDesktop) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/inquiry-submitted-modal-1440.png` })
  }

  // Act — 확인으로 닫으면 주소에서 1회성 파라미터가 사라진다
  await dialog.getByRole('button', { name: '확인' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(`${LIST_PATH}/${inquiryId}`)

  // Act — 새로고침해도 다시 뜨지 않는다
  await page.reload()
  await expect(page.getByRole('dialog', { name: '문의가 접수되었습니다' })).toHaveCount(0)

  // Assert — 상세 본문: 제목 · 접수 대기 · 답변 대기 문구
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expect(page.getByText('접수 대기')).toBeVisible()
  await expect(page.getByText('운영자가 확인 중입니다')).toBeVisible()

  if (isDesktop) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/inquiry-detail-1440.png`, fullPage: true })
  }

  // Act — 목록
  await page.goto(LIST_PATH)

  // Assert — 방금 접수한 문의가 접수 대기 상태로 보인다
  const row = page.getByRole('link', { name: new RegExp(title) })
  await expect(row).toBeVisible()
  await expect(row).toContainText('접수 대기')
  await expect(row).toContainText('계정 · 문의')
  await expect(row).toContainText('답변 0')

  if (isDesktop) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/inquiries-list-1440.png`, fullPage: true })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.reload()
    await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible()
    await page.screenshot({ path: `${SCREENSHOT_DIR}/inquiries-390.png`, fullPage: true })
    await page.setViewportSize({ width: 1440, height: 1200 })
  }

  // Act — 운영자 답변(서비스 롤 스크립트)
  execFileSync(
    'node',
    ['--env-file=.env.local', 'tests/manual/inquiry-reply-insert.mjs', inquiryId],
    { stdio: 'pipe' },
  )

  await page.goto(`${LIST_PATH}/${inquiryId}`)

  // Assert — 답변 스레드에 운영자 답변이 뜨고 상태가 올라간다
  await expect(page.getByText(REPLY_CONTENT)).toBeVisible()
  await expect(page.getByText('운영자', { exact: true })).toBeVisible()
  await expect(page.getByText('답변 완료')).toBeVisible()

  // Assert — 비로그인은 상세에서 로그인으로 안내된다
  const anonymousContext = await browser.newContext()
  const anonymousPage = await anonymousContext.newPage()
  await anonymousPage.goto(`${LIST_PATH}/${inquiryId}`)
  await expect(anonymousPage).toHaveURL(
    `/login?next=${encodeURIComponent(`${LIST_PATH}/${inquiryId}`)}`,
  )
  await anonymousContext.close()

  // Assert — 다른 계정에게는 존재하지 않는 글이다
  const otherContext = await browser.newContext()
  const otherPage = await otherContext.newPage()
  await stubLogin(otherPage, SUPPORT_PATH)
  await otherPage.goto(`${LIST_PATH}/${inquiryId}`)
  await expect(
    otherPage.getByRole('heading', { name: '요청하신 글을 찾을 수 없습니다' }),
  ).toBeVisible()
  await otherContext.close()
})
