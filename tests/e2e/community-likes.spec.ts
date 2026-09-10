import { expect, test } from '@playwright/test'

import type { Locator, Page, TestInfo } from '@playwright/test'

/**
 * 좋아요 토글.
 *
 * 비로그인은 로그인으로 안내되는지만 보고, 로그인 흐름은 스텁 간편로그인으로
 * 실제 계정을 하나 만들어 끝까지 확인한다(누름 → 새로고침 후에도 유지 → 취소).
 *
 * 프로젝트(chromium · Pixel 7)가 병렬로 도는데 둘 다 같은 글을 누르면 집계가
 * 서로를 밀어낸다. 프로젝트별로 다른 글을 쓴다.
 */

const POST_BY_PROJECT: Record<string, string> = {
  chromium: '22222222-0000-4000-8000-000000000005',
  'Pixel 7': '22222222-0000-4000-8000-000000000006',
}
const FALLBACK_POST_ID = '22222222-0000-4000-8000-000000000007'

/** 서버 액션의 연타 방지(1초)를 넘기기 위한 최소 간격. */
const COOLDOWN_MS = 1200

function detailPath(testInfo: TestInfo): string {
  return `/community/${POST_BY_PROJECT[testInfo.project.name] ?? FALLBACK_POST_ID}`
}

function likeButton(page: Page): Locator {
  return page.getByRole('button', { name: /좋아요/ })
}

async function readCount(button: Locator): Promise<number> {
  const text = (await button.textContent()) ?? ''

  return Number(text.replace(/[^0-9]/g, ''))
}

async function isPressed(button: Locator): Promise<boolean> {
  return (await button.getAttribute('aria-pressed')) === 'true'
}

/**
 * 누르고 **서버가 답할 때까지** 기다린다.
 *
 * 버튼은 낙관적으로 먼저 움직이므로, 응답을 기다리지 않고 새로고침하면 아직
 * 날아가고 있던 서버 액션 요청이 취소된다(화면은 눌린 것처럼 보였는데 DB 에는
 * 아무것도 남지 않는다). 서버 액션은 현재 주소로 POST 하므로 그 응답을 잡는다.
 *
 * 누르기 전에 통신이 잦아들기를 먼저 기다린다. 상세 화면은 마운트 직후
 * 조회수 서버 액션(`recordPostView`)을 같은 주소로 POST 하기 때문에, 그것이
 * 아직 날아가는 중이면 좋아요 응답 대신 그 응답을 잡아 버린다.
 */
async function clickLike(page: Page, button: Locator): Promise<void> {
  await page.waitForLoadState('networkidle')

  const submitted = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url() === page.url(),
  )

  await button.click()
  await submitted
}

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
 * 두 경우를 모두 받아 준다.
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

test('should send anonymous visitors to login when they try to like', async ({
  page,
}, testInfo) => {
  // Arrange
  const path = detailPath(testInfo)
  await page.goto(path)

  const button = likeButton(page)

  // Assert — 버튼 자체는 보인다(누를 방법이 있다는 사실은 알려 준다)
  await expect(button).toBeVisible()
  await expect(button).toHaveAttribute('aria-pressed', 'false')

  // Act
  await button.click()

  // Assert
  await expect(page).toHaveURL(`/login?next=${encodeURIComponent(path)}`)
})

test('should toggle a like, keep it across a reload, and take it back', async ({
  page,
}, testInfo) => {
  // Arrange
  const path = detailPath(testInfo)
  await stubLogin(page, path)

  const button = likeButton(page)
  await expect(button).toBeVisible()

  const pressedBefore = await isPressed(button)
  const countBefore = await readCount(button)
  const toggledCount = pressedBefore ? countBefore - 1 : countBefore + 1

  // Act — 누른다
  await clickLike(page, button)

  // Assert — 상태와 숫자가 함께 뒤집힌다
  await expect(button).toHaveAttribute('aria-pressed', String(!pressedBefore))
  await expect(button).toHaveText(new RegExp(`좋아요 ${toggledCount}$`))

  // Act — 새로고침
  await page.reload()

  // Assert — 서버가 기억하고 있다
  const reloaded = likeButton(page)
  await expect(reloaded).toHaveAttribute('aria-pressed', String(!pressedBefore))
  await expect(reloaded).toHaveText(new RegExp(`좋아요 ${toggledCount}$`))

  // Act — 다시 눌러 되돌린다 (서버 쿨다운을 넘긴 뒤)
  await page.waitForTimeout(COOLDOWN_MS)
  await clickLike(page, reloaded)

  // Assert
  await expect(reloaded).toHaveAttribute('aria-pressed', String(pressedBefore))
  await expect(reloaded).toHaveText(new RegExp(`좋아요 ${countBefore}$`))
})
